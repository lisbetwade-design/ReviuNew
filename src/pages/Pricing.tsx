import React from 'react';
import { stripeProducts } from '../stripe-config';
import { SubscriptionCard } from '../components/subscription/SubscriptionCard';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

export function Pricing() {
  const { user } = useAuth();
  const { subscription } = useSubscription();

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Select the perfect plan for your needs
          </p>
        </div>

        {!user && (
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">
              You need to be signed in to subscribe
            </p>
            <div className="space-x-4">
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}

        <div className="mt-12 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
          {stripeProducts.map((product) => {
            const isActive = subscription?.price_id === product.priceId && 
                           ['active', 'trialing'].includes(subscription.subscription_status);
            
            return (
              <SubscriptionCard
                key={product.id}
                product={product}
                isActive={isActive}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}