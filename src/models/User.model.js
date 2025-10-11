/**
 * User Model
 * Admin user accounts
 */

const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const { getCollection } = require('../utils/db.util');

class User {
  /**
   * Create a new user
   */
  static async create(data) {
    const collection = await getCollection('users');

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role || 'admin', // admin/moderator/viewer
      created_at: new Date(),
      last_login: null,
      active: data.active !== undefined ? data.active : true
    };

    const result = await collection.insertOne(user);

    // Return user without password
    const { password, ...userWithoutPassword } = { ...user, _id: result.insertedId };
    return userWithoutPassword;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const collection = await getCollection('users');
    const user = await collection.findOne({ _id: new ObjectId(id) });

    if (user) {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const collection = await getCollection('users');
    return await collection.findOne({ email: email.toLowerCase() });
  }

  /**
   * Authenticate user
   */
  static async authenticate(email, password) {
    const user = await this.findByEmail(email);

    if (!user || !user.active) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return null;
    }

    // Update last login
    await this.updateLastLogin(user._id);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id) {
    const collection = await getCollection('users');

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { last_login: new Date() } }
    );
  }

  /**
   * Update user
   */
  static async update(id, updates) {
    const collection = await getCollection('users');

    // Remove password from updates (use changePassword for that)
    const { password, ...safeUpdates } = updates;

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: safeUpdates }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Change password
   */
  static async changePassword(id, newPassword) {
    const collection = await getCollection('users');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { password: hashedPassword } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Deactivate user
   */
  static async deactivate(id) {
    const collection = await getCollection('users');

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { active: false } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * List all users
   */
  static async list(options = {}) {
    const collection = await getCollection('users');
    const { limit = 50, skip = 0 } = options;

    const users = await collection
      .find({}, { projection: { password: 0 } })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return users;
  }

  /**
   * Count users
   */
  static async count(filter = {}) {
    const collection = await getCollection('users');
    return await collection.countDocuments(filter);
  }

  /**
   * Delete user
   */
  static async delete(id) {
    const collection = await getCollection('users');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}

module.exports = User;
