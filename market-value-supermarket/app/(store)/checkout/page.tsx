import CheckoutForm from '@/components/CheckoutForm';

export const metadata = { title: 'Checkout' };

export default function CheckoutPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>
      <CheckoutForm />
    </div>
  );
}
