// Yeh interface apni types.ts file mein WordpressConnection ke bagal add kar do

export interface ShopifyConnection {
  id: string;
  user_id: string;
  shop_domain: string;
  access_token: string;
  connected_at: string;
  last_used_at: string | null;
}

// Optimization interface mein yeh field add karo (WordpressConnection wale ke bagal):
// shopify_connection_id: string | null;
