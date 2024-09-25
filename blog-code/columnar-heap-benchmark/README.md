# Postgres Columnar to Heap Performance Test Procedure

This is a short procedure we developed to obtain simple write-metrics comparing Postgres Heap to Columnar storage performance. Tembo presented the [pg_timeseries](https://github.com/tembo-io/pg_timeseries) extension to the Chicago Postgres User Group. We wrote this code as a follow-up to an audience question about how Columnar storage behavior compared to standard heap.

## Installation

The tables and functions in this library are defined in the `create-test-schema.sql` file of this repository. Install them into a working Postgres instance with the pg_timeseries extension installed:

```sh
psql -f create-test-schema.sql postgres
```

This library also includes a `docker-compose.yaml` file that will start a Postgres container with pg_timeseries enabled. To use it, change to the directory with the `docker-compose.yaml` and:

```sh
docker compose create
docker compose start
```

Then install the benchmark library:

```sh
psql -h localhost -U postgres -f create-test-schema.sql postgres
```

Alternatively, create a Tembo [Hobby instance](https://cloud.tembo.io/) and install the pg_timeseries extension through the web interface.

## How the Benchmark Works

This is the full procedure used by the test system we describe here:

1. A `docker-compose.yaml` definition to bootstrap a fresh container using `pg_timeseries`. It also sets `shared_buffers` to 2GB and `max_wal_size` to `200GB`, mainly to avoid unwanted checkpoints caused by all of the write activity.
2. A function that will switch all test partitions to either columnar or heap storage.
3. An unlogged table to contain generated data prior to writing to the test partitions.
4. A function to generate test data.
5. A function to run the tests, which calls:
    * A separate function for inserts, updates, and deletes.
    * The previously mentioned storage switching function.
    * The data-generation function.

The word "function" is a bit of a misnomer here, as all code is written as stored procedures. Procedures in Postgres have full transaction control, so we can `COMMIT` after collecting each data point and see progress as it's generated instead of at the end of the entire test run. We can also do things like run `CHECKPOINT` between tests so each test has a fresh starting point and we're unlikely to cause an emergency checkpoint due to write activity.

The process works like this:

1. Create the `divvy_trips` partition tables.
2. Create the `sample_data` table to hold test results.
3. Create the `chungus` table to contain generated test data.
4. Execute `sp_run_tests` to run all of the tests, which will:
   - Call `sp_set_storage` to start with heap storage.
   - For the requested test count and chunk size:
     - Call `sp_scale_chungus` to generate data for that test iteration chunk size.
     - Truncate the `divvy_trips` table.
     - Call `sp_insert_test` for insert timings.
     - Call `sp_update_test` for update timings.
     - Call `sp_delete_test` for delete timings.
     - Repeat all insert, update, delete tests 5 times for accuracy.
   - Repeat entire test process for columnar storage.
5. Wait.

Results should be in the `sample_data` table when the test is complete.

## Tables Used by the Tests

The demonstration at the talk used the Chicago Divvy data, thus these tests mimic that data. This approach should more closely reflect the real-world Divvy use case rather than some contrived scenario, and it's on-topic for the talk itself.

```sql
CREATE EXTENSION timeseries CASCADE;

CREATE TABLE IF NOT EXISTS divvy_trips (
    ride_id             TEXT NOT NULL,
    rideable_type       TEXT NULL,
    started_at          TIMESTAMP NOT NULL,
    ended_at            TIMESTAMP NOT NULL,
    start_station_name  TEXT,
    start_station_id    TEXT,
    end_station_name    TEXT,
    end_station_id      TEXT,
    start_lat           FLOAT,
    start_lng           FLOAT,
    end_lat             FLOAT,
    end_lng             FLOAT,
    member_casual       TEXT
) PARTITION BY RANGE (started_at);

SELECT enable_ts_table(
    target_table_id => 'divvy_trips',
    partition_duration => '1 month',
    initial_table_start => '2020-01-01'
);
```

The use of `enable_ts_table` is purely for convenience. This causes `pg_timeseries` to create all extensions from the beginning of 2020 to the current date. That will allow up to four years of data with `started_at` times at one-second granularity.

Then come the two tables for the tests themselves.

```sql
CREATE UNLOGGED TABLE chungus (LIKE divvy_trips);

CREATE UNLOGGED TABLE sample_data (
    id         INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    test_type  TEXT NOT NULL,
    storage    TEXT NOT NULL,
    row_count  INT NOT NULL,
    duration   INTERVAL NOT NULL
);
```

As previously mentioned, the `chungus` table purely exists for the test procedures to fill with generated data. Then that data is used for the insert step to avoid adding the generation process to the timing results. The `sample_data` table is meant to track the tests themselves. This lets us categorize tests by row count, the type of test---as insert, update, or delete---and whether the storage type is heap or columnar.

These various labels give us quite a few options for analyzing the timing data.

## Determining Table Storage

The `pg_timeseries` extension does have a built-in system for converting partitions to columnar storage once they surpass a configured duration. But rather than tricking it into applying this process to _all_ tables, we elected to build our own system. We initially started with an anonymous block like this:

```sql
DO $$
DECLARE
  part_tab REGCLASS;
BEGIN
    FOR part_tab IN 
        SELECT oid FROM pg_class
         WHERE relname LIKE 'divvy\_trips\_%'
           AND relkind = 'r'
    LOOP
        EXECUTE format($SQL$
          ALTER TABLE %I SET ACCESS METHOD %s;
        $SQL$, part_tab, 'columnar');
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

We can verify that the partitions were properly converted to `columnar` storage with this query:

```sql
SELECT c.relname AS table_name, 
       am.amname AS storage
  FROM pg_class c
  JOIN pg_am am ON (am.oid = c.relam)
 WHERE c.relname LIKE 'divvy\_trips\_%'
   AND relkind = 'r';
```

Then we converted that anonymous block to a function so we could swap to `heap` or `columnar` as required.

## Test Invocation

The procedures in this library output helpful status messages for the sake of convenience. This includes the procedure that converts the partitions to heap or columnar storage however, and that can be fairly noisy. To keep the output from getting oppressive, it's possible to set the minimum client message level to `WARNING` to suppress all of the `INFO` output.

That means we can run our tests using however many chunks and iterations as we desire. For example:

```sql
SET client_min_messages = 'WARNING';
CALL sp_run_tests(20, 250000);
```

This would run 20 tests starting at 250,000 rows and ending at five million rows (250,000 * 20). This lets us see if row count affects timings and to what extent. The results are categorized by row count, storage type, and write action, so we can slice and dice it several different ways as well.

Here's an example that will provide an average execution time by row count and storage type, for inserts, updates, and deletes:

```sql
WITH adjusted AS (
    SELECT row_count, storage, test_type,
           extract(milliseconds FROM duration) AS total_ms
      FROM sample_data
)
SELECT row_count, storage,
       round(avg(total_ms) FILTER (WHERE test_type = 'INSERT')) AS insert_ms,
       round(avg(total_ms) FILTER (WHERE test_type = 'UPDATE')) AS update_ms,
       round(avg(total_ms) FILTER (WHERE test_type = 'DELETE')) AS delete_ms
  FROM adjusted
 GROUP BY row_count, storage
 ORDER BY row_count, storage;
```

Note that this makes use of the more contemporary [`FILTER` clause](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES). It's a much simpler replacement for the old `sum(CASE WHEN x THEN 1 ELSE 0 END)` method when dealing with fractional aggregates.

