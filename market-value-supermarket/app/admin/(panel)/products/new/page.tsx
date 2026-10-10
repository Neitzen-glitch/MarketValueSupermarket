import ProductForm from '@/components/admin/ProductForm';

export const metadata = { title: 'Add product' };

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add a product</h1>
      <ProductForm
        initial={{
          id: null,
          name: '',
          category: '',
          description: '',
          deliveryFee: '',
          deliveryNote: '',
          status: 'published',
          imageUrl: null,
          variants: [{ id: null, name: '', price: '', stock: '', tiers: [] }],
          basket: { enabled: false, totalShares: '', sharePrice: '', sharesLeft: '', open: true },
        }}
      />
    </div>
  );
}
