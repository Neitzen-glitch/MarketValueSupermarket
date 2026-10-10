import NewsletterForm from './NewsletterForm';

export default function Footer() {
  return (
    <footer className="mt-16 bg-brown text-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Get fresh stock alerts</h2>
          <p className="mt-2 text-sm text-cream/80">
            Leave your email, your phone number, or both. Whenever new stock lands, we will message you straight away.
          </p>
        </div>
        <NewsletterForm />
      </div>
      <div className="border-t border-cream/15 py-4 text-center text-xs text-cream/70">
        © {new Date().getFullYear()} Market Value Supermarket
      </div>
    </footer>
  );
}
