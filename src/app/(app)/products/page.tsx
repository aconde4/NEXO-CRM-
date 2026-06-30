import type { Metadata } from "next";

import { ProductsView } from "@/components/products/products-view";
import { PageHeader } from "@/components/page-header";
import { listProducts } from "@/server/queries/quotes";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductsPage() {
  const products = await listProducts();
  return (
    <>
      <PageHeader
        title="Productos"
        description="Tu catálogo de productos y servicios para los presupuestos."
      />
      <ProductsView products={products} />
    </>
  );
}
