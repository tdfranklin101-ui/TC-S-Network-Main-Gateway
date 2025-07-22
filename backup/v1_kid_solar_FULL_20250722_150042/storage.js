/**
 * Storage Module for Member Data
 * 
 * This module provides an interface for accessing and managing
 * member data stored in the PostgreSQL database.
 */

const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * Database-backed storage implementation for member data
 */
class DatabaseStorage {
  // Member operations
  async getMembers() {
    try {
      const result = await pool.query('SELECT * FROM members ORDER BY id');
      return result.rows;
    } catch (error) {
      console.error('Error fetching members:', error);
      return [];
    }
  }
  
  async getMember(id) {
    try {
      const result = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
      return result.rows[0];
    } catch (error) {
      console.error(`Error fetching member ${id}:`, error);
      return undefined;
    }
  }
  
  async getMemberByUsername(username) {
    try {
      const result = await pool.query('SELECT * FROM members WHERE username = $1', [username]);
      return result.rows[0];
    } catch (error) {
      console.error(`Error fetching member by username ${username}:`, error);
      return undefined;
    }
  }
  
  async getMemberByEmail(email) {
    try {
      const result = await pool.query('SELECT * FROM members WHERE email = $1', [email]);
      return result.rows[0];
    } catch (error) {
      console.error(`Error fetching member by email ${email}:`, error);
      return undefined;
    }
  }
  
  async createMember(data) {
    try {
      const result = await pool.query(`
        INSERT INTO members (
          username, name, email, joined_date, total_solar, total_dollars,
          is_anonymous, is_reserve, is_placeholder, last_distribution_date, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        data.username,
        data.name,
        data.email,
        data.joinedDate,
        data.totalSolar.toString(),
        data.totalDollars.toString(),
        data.isAnonymous || false,
        data.isReserve || false,
        data.isPlaceholder || false,
        data.lastDistributionDate,
        data.notes || null
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating member:', error);
      throw error;
    }
  }
  
  async updateMember(id, data) {
    try {
      // Build the update query dynamically based on provided fields
      const updates = [];
      const values = [];
      let paramIndex = 1;
      
      // Add fields to update only if they are provided
      if (data.username !== undefined) {
        updates.push(`username = $${paramIndex++}`);
        values.push(data.username);
      }
      
      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      
      if (data.email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(data.email);
      }
      
      if (data.joinedDate !== undefined) {
        updates.push(`joined_date = $${paramIndex++}`);
        values.push(data.joinedDate);
      }
      
      if (data.totalSolar !== undefined) {
        updates.push(`total_solar = $${paramIndex++}`);
        values.push(data.totalSolar.toString());
      }
      
      if (data.totalDollars !== undefined) {
        updates.push(`total_dollars = $${paramIndex++}`);
        values.push(data.totalDollars.toString());
      }
      
      if (data.isAnonymous !== undefined) {
        updates.push(`is_anonymous = $${paramIndex++}`);
        values.push(data.isAnonymous);
      }
      
      if (data.isReserve !== undefined) {
        updates.push(`is_reserve = $${paramIndex++}`);
        values.push(data.isReserve);
      }
      
      if (data.isPlaceholder !== undefined) {
        updates.push(`is_placeholder = $${paramIndex++}`);
        values.push(data.isPlaceholder);
      }
      
      if (data.lastDistributionDate !== undefined) {
        updates.push(`last_distribution_date = $${paramIndex++}`);
        values.push(data.lastDistributionDate);
      }
      
      if (data.notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`);
        values.push(data.notes);
      }
      
      // If no fields to update, return the existing member
      if (updates.length === 0) {
        return this.getMember(id);
      }
      
      // Add the ID as the last parameter
      values.push(id);
      
      const result = await pool.query(`
        UPDATE members 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
      
      return result.rows[0];
    } catch (error) {
      console.error(`Error updating member ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteMember(id) {
    try {
      const result = await pool.query('DELETE FROM members WHERE id = $1 RETURNING id', [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error deleting member ${id}:`, error);
      return false;
    }
  }
  
  // Distribution operations
  async createDistributionLog(data) {
    try {
      const result = await pool.query(`
        INSERT INTO distribution_logs (
          member_id, distribution_date, solar_amount, dollar_value
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        data.memberId,
        data.distributionDate,
        data.solarAmount.toString(),
        data.dollarValue.toString()
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating distribution log:', error);
      throw error;
    }
  }
  
  async getDistributionLogs(memberId) {
    try {
      let query = 'SELECT * FROM distribution_logs ORDER BY timestamp DESC';
      let params = [];
      
      if (memberId) {
        query = 'SELECT * FROM distribution_logs WHERE member_id = $1 ORDER BY timestamp DESC';
        params = [memberId];
      }
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching distribution logs:', error);
      return [];
    }
  }
  
  async getLastDistribution(memberId) {
    try {
      const result = await pool.query(`
        SELECT * FROM distribution_logs 
        WHERE member_id = $1 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [memberId]);
      
      return result.rows[0];
    } catch (error) {
      console.error(`Error fetching last distribution for member ${memberId}:`, error);
      return undefined;
    }
  }
  
  // Backup operations
  async createBackupLog(data) {
    try {
      const result = await pool.query(`
        INSERT INTO backup_logs (
          backup_type, filename, member_count
        ) VALUES ($1, $2, $3)
        RETURNING *
      `, [
        data.backupType,
        data.filename,
        data.memberCount
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating backup log:', error);
      throw error;
    }
  }
  
  async getBackupLogs() {
    try {
      const result = await pool.query('SELECT * FROM backup_logs ORDER BY timestamp DESC');
      return result.rows;
    } catch (error) {
      console.error('Error fetching backup logs:', error);
      return [];
    }
  }
  
  // Import/Export
  async importMembersFromJson(filePath) {
    try {
      const jsonData = fs.readFileSync(filePath, 'utf8');
      const memberList = JSON.parse(jsonData);
      return await this.migrateFileBasedMembersToDatabase(memberList);
    } catch (error) {
      console.error('Error importing members from JSON:', error);
      return { success: false, imported: 0, errors: [error.message] };
    }
  }
  
  async exportMembersToJson(filePath) {
    try {
      const members = await this.getMembers();
      fs.writeFileSync(filePath, JSON.stringify(members, null, 2));
      return { success: true, exported: members.length };
    } catch (error) {
      console.error('Error exporting members to JSON:', error);
      return { success: false, exported: 0 };
    }
  }
  
  // Migration assistance
  async migrateFileBasedMembersToDatabase(membersList) {
    const errors = [];
    let migratedCount = 0;
    
    try {
      // Begin transaction
      await pool.query('BEGIN');
      
      for (const memberData of membersList) {
        // Skip placeholders
        if (memberData.isPlaceholder) {
          continue;
        }
        
        try {
          // Prepare member data for database
          const memberEmail = memberData.email || `${memberData.username}@thecurrentsee.org`;
          
          // Check if member already exists (by username)
          const existingCheck = await pool.query(
            'SELECT id FROM members WHERE username = $1',
            [memberData.username]
          );
          
          if (existingCheck.rows.length === 0) {
            // Create new member
            await pool.query(`
              INSERT INTO members (
                username, name, email, joined_date, total_solar, total_dollars,
                is_anonymous, is_reserve, last_distribution_date, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
              memberData.username,
              memberData.name,
              memberEmail,
              memberData.joinedDate,
              memberData.totalSolar.toString(),
              memberData.totalDollars.toString(),
              memberData.isAnonymous || false,
              memberData.isReserve || false,
              memberData.lastDistributionDate,
              memberData.notes || null
            ]);
            migratedCount++;
          } else {
            // Update existing member
            await pool.query(`
              UPDATE members SET 
                name = $1, email = $2, joined_date = $3, total_solar = $4,
                total_dollars = $5, is_anonymous = $6, is_reserve = $7, 
                last_distribution_date = $8, notes = $9
              WHERE username = $10
            `, [
              memberData.name,
              memberEmail,
              memberData.joinedDate,
              memberData.totalSolar.toString(),
              memberData.totalDollars.toString(),
              memberData.isAnonymous || false,
              memberData.isReserve || false,
              memberData.lastDistributionDate,
              memberData.notes || null,
              memberData.username
            ]);
            migratedCount++;
          }
        } catch (memberError) {
          errors.push({
            member: memberData.username,
            error: memberError.message
          });
        }
      }
      
      // If no errors, commit the transaction
      if (errors.length === 0) {
        await pool.query('COMMIT');
      } else {
        await pool.query('ROLLBACK');
      }
      
      return {
        success: errors.length === 0,
        imported: migratedCount,
        errors
      };
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      return {
        success: false,
        imported: migratedCount,
        errors: [...errors, error.message]
      };
    }
  }
}

// Export an instance of the storage
const storage = new DatabaseStorage();

module.exports = {
  storage
};