"use server";

import { redirect } from "next/navigation";
import { Pool } from "pg";

export type Product = {
  id?: number;
  title: string;
  description: string;
  category: string;
  price: string;
  brand: string;
  condition: string;
  color: string;
};

const pool = new Pool({
  connectionString: process.env.POSTGRES_VECTORDB_URL!,
  ssl: {
    ca: process.env.POSTGRES_CA_CERT!,
  },
});

export async function list() {
  const client = await pool.connect();
  try {
    const query = `SELECT * FROM products`;
    const result = await client.query(query);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function load(product: Product) {
  const { title, description, category, price, brand, condition, color } =
    product;

  const client = await pool.connect();
  try {
    const query = `INSERT INTO products (title, description, category, price, brand, condition, color) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
    const values = [
      title,
      description,
      category,
      price,
      brand,
      condition,
      color,
    ];
    const result = await client.query(query, values);

    redirect("/");
    return result;
  } finally {
    client.release();
  }
}

export async function get(id: number) {
  const client = await pool.connect();
  const query = `SELECT * FROM products WHERE id = $1`;
  const result = await client.query(query, [id]);
  return result.rows[0];
}

export async function update(product: Product) {
  const { id, title, description, category, price, brand, condition, color } =
    product;
  const client = await pool.connect();

  try {
    const query = `UPDATE products SET title = $1, description = $2, category = $3, price = $4, brand = $5, condition = $6, color = $7 WHERE id = $8`;
    const values = [
      title,
      description,
      category,
      price,
      brand,
      condition,
      color,
      id,
    ];

    await client.query(query, values);
    redirect("/");
  } finally {
    client.release();
  }
}

export async function deleteProduct(id: number) {
  const client = await pool.connect();
  try {
    const query = `DELETE FROM products WHERE id = $1`;
    await client.query(query, [id]);
    redirect("/");
  } finally {
    client.release();
  }
}

export async function searchProducts(query: string) {
  const client = await pool.connect();
  try {
    const searchQuery = `
      SELECT * FROM vectorize.search(
        job_name => 'product_search_openai',
        query => $1,
        return_columns => ARRAY['id', 'title', 'description', 'category', 'price', 'brand', 'condition', 'color'],
        num_results => 10
      );
    `;
    const result = await client.query(searchQuery, [query]);
    const parsedResult = result.rows.map((row) => {
      const parsedRow = row.search_results;
      return {
        id: parsedRow.id as number,
        title: parsedRow.title as string,
        description: parsedRow.description as string,
        category: parsedRow.category as string,
        price: parsedRow.price as string,
        brand: parsedRow.brand as string,
        condition: parsedRow.condition as string,
        color: parsedRow.color as string,
        similarity_score: parsedRow.similarity_score as number,
      };
    });
    return parsedResult;
  } finally {
    client.release();
  }
}
