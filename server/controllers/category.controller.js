const db = require('../database/stockDb');

exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await db.all(
      `SELECT c.*, COUNT(p.id) as product_count 
       FROM categories c 
       LEFT JOIN products p ON c.id = p.category_id 
       GROUP BY c.id 
       ORDER BY c.name ASC`
    );
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

exports.getCategoryById = async (req, res, next) => {
  try {
    const category = await db.get(
      `SELECT c.*, COUNT(p.id) as product_count 
       FROM categories c 
       LEFT JOIN products p ON c.id = p.category_id 
       WHERE c.id = ? 
       GROUP BY c.id`,
      [req.params.id]
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const result = await db.run(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description]
    );

    res.status(201).json({ 
      message: 'Category created successfully', 
      categoryId: result.lastID 
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    await db.run(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description, req.params.id]
    );

    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    // Check if category has products
    const products = await db.get(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [req.params.id]
    );

    if (products.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with associated products' 
      });
    }

    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};
