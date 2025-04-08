import {
  User,
  InsertUser,
  Product,
  InsertProduct,
  NewsletterSubscription,
  InsertNewsletterSubscription,
  ContactMessage,
  InsertContactMessage
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  
  // Newsletter subscription methods
  createNewsletterSubscription(subscription: InsertNewsletterSubscription): Promise<NewsletterSubscription>;
  
  // Contact message methods
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private newsletterSubscriptions: Map<number, NewsletterSubscription>;
  private contactMessages: Map<number, ContactMessage>;
  
  private userCurrentId: number;
  private productCurrentId: number;
  private subscriptionCurrentId: number;
  private messageCurrentId: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.newsletterSubscriptions = new Map();
    this.contactMessages = new Map();
    
    this.userCurrentId = 1;
    this.productCurrentId = 1;
    this.subscriptionCurrentId = 1;
    this.messageCurrentId = 1;
    
    // Initialize with sample products
    this.initializeSampleProducts();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Product methods
  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.productCurrentId++;
    const product: Product = { ...insertProduct, id };
    this.products.set(id, product);
    return product;
  }
  
  // Newsletter subscription methods
  async createNewsletterSubscription(insertSubscription: InsertNewsletterSubscription): Promise<NewsletterSubscription> {
    const id = this.subscriptionCurrentId++;
    const subscription: NewsletterSubscription = { 
      ...insertSubscription, 
      id, 
      subscribedAt: new Date() 
    };
    this.newsletterSubscriptions.set(id, subscription);
    return subscription;
  }
  
  // Contact message methods
  async createContactMessage(insertMessage: InsertContactMessage): Promise<ContactMessage> {
    const id = this.messageCurrentId++;
    const message: ContactMessage = { 
      ...insertMessage, 
      id, 
      sentAt: new Date() 
    };
    this.contactMessages.set(id, message);
    return message;
  }
  
  // Initialize sample products
  private initializeSampleProducts() {
    const sampleProducts: InsertProduct[] = [
      {
        name: "Solar Future T-Shirt",
        description: "100% organic cotton t-shirt featuring our \"Power the Future\" design.",
        price: 2999, // $29.99
        imageUrl: "https://images.unsplash.com/photo-1618354691792-d1d42acfd860?auto=format&fit=crop&w=600&h=400&q=80",
        isNew: true
      },
      {
        name: "Solar Power Bank",
        description: "10,000mAh solar-rechargeable power bank with Current-See branding.",
        price: 4999, // $49.99
        imageUrl: "https://images.unsplash.com/photo-1603557244695-37478f2ef0c1?auto=format&fit=crop&w=600&h=400&q=80",
        isNew: false
      },
      {
        name: "Insulated Water Bottle",
        description: "Stainless steel insulated bottle with our mission statement and logo.",
        price: 3499, // $34.99
        imageUrl: "https://images.unsplash.com/photo-1618403323851-eb733d77465b?auto=format&fit=crop&w=600&h=400&q=80",
        isNew: false
      }
    ];
    
    sampleProducts.forEach(product => {
      this.createProduct(product);
    });
  }
}

export const storage = new MemStorage();
