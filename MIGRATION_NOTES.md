# Database Migration Guide

## Adding Customer and Supplier Routes

I've added the following new routes to your backend:

### Customer Routes
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Supplier Routes
- `GET /api/suppliers` - Get all suppliers
- `GET /api/suppliers/:id` - Get supplier by ID
- `POST /api/suppliers` - Create new supplier
- `PUT /api/suppliers/:id` - Update supplier
- `DELETE /api/suppliers/:id` - Delete supplier

## Database Schema Updates

The customer and supplier tables have been updated with new fields:
- `city` (TEXT) - City name
- `state` (TEXT) - State name
- `zip_code` (TEXT) - ZIP code

## Important: Reset Database to Apply Changes

If you already have an `inventory.db` file, you need to delete it so a new one can be created with the updated schema:

1. Stop the server
2. Navigate to `server/database/`
3. Delete `inventory.db`
4. Restart the server - a new database will be created with all the new fields

## How to Use the New Forms

1. Click "Add Customer" on the Customers page
2. Fill in the form (Name, Phone, Email are required)
3. Add optional address details (City, State, ZIP Code)
4. Click Save

The same applies for Suppliers and Products.

All fields are sent to the backend and stored in the database.
