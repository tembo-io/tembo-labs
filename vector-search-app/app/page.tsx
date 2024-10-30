import ClientProductList from "./_components/ClientProductList";
import { list } from "./actions/vectordb";

export default async function Home() {
  const initialProducts = await list();

  return <ClientProductList initialProducts={initialProducts || []} />;
}
