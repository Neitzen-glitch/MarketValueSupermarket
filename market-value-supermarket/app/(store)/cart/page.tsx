import CartView from '@/components/CartView';

export const metadata = { title: 'Your cart' };

export default function CartPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Your cart</h1>
      <CartView />
    </div>
  );
}
