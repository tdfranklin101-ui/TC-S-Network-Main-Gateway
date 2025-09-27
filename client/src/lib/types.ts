export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  isNew: boolean;
}

export interface NewsletterSubscription {
  email: string;
}

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
}
