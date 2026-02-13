export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  currencySymbol: string;
  mode: 'payment' | 'subscription';
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_TxVk8q3ZHc2SsW',
    priceId: 'price_1SzajNEHmk3eUteQSKqtEDrh',
    name: 'Reviu App',
    description: 'Premium subscription for Reviu App with full access to all features',
    price: 15.00,
    currency: 'eur',
    currencySymbol: '€',
    mode: 'subscription'
  }
];

export function getProductById(id: string): StripeProduct | undefined {
  return stripeProducts.find(product => product.id === id);
}

export function getProductByPriceId(priceId: string): StripeProduct | undefined {
  return stripeProducts.find(product => product.priceId === priceId);
}