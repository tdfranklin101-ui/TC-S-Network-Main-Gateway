import { eq, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { members, distributionLogs, backupLogs, type Member, type InsertMember, type DistributionLog, type InsertDistributionLog, type BackupLog, type InsertBackupLog } from '../shared/schema';
import fs from 'fs';
import path from 'path';

// Storage interface for member data
export interface IStorage {
  // Member operations
  getMembers(): Promise<Member[]>;
  getMember(id: number): Promise<Member | undefined>;
  getMemberByUsername(username: string): Promise<Member | undefined>;
  getMemberByEmail(email: string): Promise<Member | undefined>;
  createMember(data: InsertMember): Promise<Member>;
  updateMember(id: number, data: Partial<InsertMember>): Promise<Member | undefined>;
  deleteMember(id: number): Promise<boolean>;
  
  // Distribution operations
  createDistributionLog(data: InsertDistributionLog): Promise<DistributionLog>;
  getDistributionLogs(memberId?: number): Promise<DistributionLog[]>;
  getLastDistribution(memberId: number): Promise<DistributionLog | undefined>;
  
  // Backup operations
  createBackupLog(data: InsertBackupLog): Promise<BackupLog>;
  getBackupLogs(): Promise<BackupLog[]>;
  
  // Import/Export
  importMembersFromJson(filePath: string): Promise<{ success: boolean, imported: number, errors: any[] }>;
  exportMembersToJson(filePath: string): Promise<{ success: boolean, exported: number }>;
  
  // Migration assistance
  migrateFileBasedMembersToDatabase(membersList: any[]): Promise<{ success: boolean, migrated: number, errors: any[] }>;
}

// Implementation of the storage interface using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Member operations
  async getMembers(): Promise<Member[]> {
    return await db.select().from(members).orderBy(members.id);
  }
  
  async getMember(id: number): Promise<Member | undefined> {
    const result = await db.select().from(members).where(eq(members.id, id));
    return result[0];
  }
  
  async getMemberByUsername(username: string): Promise<Member | undefined> {
    const result = await db.select().from(members).where(eq(members.username, username));
    return result[0];
  }
  
  async getMemberByEmail(email: string): Promise<Member | undefined> {
    const result = await db.select().from(members).where(eq(members.email, email));
    return result[0];
  }
  
  async createMember(data: InsertMember): Promise<Member> {
    const result = await db.insert(members).values(data).returning();
    return result[0];
  }
  
  async updateMember(id: number, data: Partial<InsertMember>): Promise<Member | undefined> {
    const result = await db.update(members)
      .set(data)
      .where(eq(members.id, id))
      .returning();
    return result[0];
  }
  
  async deleteMember(id: number): Promise<boolean> {
    const result = await db.delete(members).where(eq(members.id, id)).returning({ id: members.id });
    return result.length > 0;
  }
  
  // Distribution operations
  async createDistributionLog(data: InsertDistributionLog): Promise<DistributionLog> {
    const result = await db.insert(distributionLogs).values(data).returning();
    return result[0];
  }
  
  async getDistributionLogs(memberId?: number): Promise<DistributionLog[]> {
    if (memberId) {
      return await db.select()
        .from(distributionLogs)
        .where(eq(distributionLogs.memberId, memberId))
        .orderBy(desc(distributionLogs.timestamp));
    }
    return await db.select()
      .from(distributionLogs)
      .orderBy(desc(distributionLogs.timestamp));
  }
  
  async getLastDistribution(memberId: number): Promise<DistributionLog | undefined> {
    const result = await db.select()
      .from(distributionLogs)
      .where(eq(distributionLogs.memberId, memberId))
      .orderBy(desc(distributionLogs.timestamp))
      .limit(1);
    return result[0];
  }
  
  // Backup operations
  async createBackupLog(data: InsertBackupLog): Promise<BackupLog> {
    const result = await db.insert(backupLogs).values(data).returning();
    return result[0];
  }
  
  async getBackupLogs(): Promise<BackupLog[]> {
    return await db.select()
      .from(backupLogs)
      .orderBy(desc(backupLogs.timestamp));
  }
  
  // Import/Export
  async importMembersFromJson(filePath: string): Promise<{ success: boolean, imported: number, errors: any[] }> {
    try {
      const jsonData = fs.readFileSync(filePath, 'utf8');
      const memberList = JSON.parse(jsonData);
      return await this.migrateFileBasedMembersToDatabase(memberList);
    } catch (error) {
      return { success: false, imported: 0, errors: [error] };
    }
  }
  
  async exportMembersToJson(filePath: string): Promise<{ success: boolean, exported: number }> {
    try {
      const members = await this.getMembers();
      fs.writeFileSync(filePath, JSON.stringify(members, null, 2));
      return { success: true, exported: members.length };
    } catch (error) {
      return { success: false, exported: 0 };
    }
  }
  
  // Migration assistance
  async migrateFileBasedMembersToDatabase(membersList: any[]): Promise<{ success: boolean, migrated: number, errors: any[] }> {
    const errors = [];
    let migratedCount = 0;
    
    try {
      // Begin transaction
      await db.transaction(async (tx) => {
        for (const memberData of membersList) {
          // Skip placeholders
          if (memberData.isPlaceholder) {
            continue;
          }
          
          try {
            // Prepare member data for database
            const insertData: InsertMember = {
              username: memberData.username,
              name: memberData.name,
              email: memberData.email || `${memberData.username}@thecurrentsee.org`,
              joinedDate: memberData.joinedDate,
              totalSolar: memberData.totalSolar.toString(),
              totalDollars: memberData.totalDollars.toString(),
              isAnonymous: memberData.isAnonymous || false,
              isReserve: memberData.isReserve || false,
              lastDistributionDate: memberData.lastDistributionDate,
              notes: memberData.notes || null
            };
            
            // Check if member already exists (by username)
            const existingMember = await tx.select()
              .from(members)
              .where(eq(members.username, memberData.username))
              .limit(1);
            
            if (existingMember.length === 0) {
              // Create new member
              await tx.insert(members).values(insertData);
              migratedCount++;
            } else {
              // Update existing member
              await tx.update(members)
                .set(insertData)
                .where(eq(members.username, memberData.username));
              migratedCount++;
            }
          } catch (memberError) {
            errors.push({
              member: memberData.username,
              error: memberError.message
            });
          }
        }
      });
      
      return {
        success: errors.length === 0,
        migrated: migratedCount,
        errors
      };
    } catch (error) {
      return {
        success: false,
        migrated: migratedCount,
        errors: [...errors, error]
      };
    }
  }
}

// Export an instance of the storage
export const storage = new DatabaseStorage();