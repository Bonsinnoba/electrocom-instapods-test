# ElectroCom Backend

## Setup Instructions

1.  **Database Setup**:
    *   Create a MySQL database named `electrocom`.
    *   Import the `schema.sql` file into your database (e.g., using phpMyAdmin or MySQL Workbench).
    *   Import the `schema.sql` file into your database (e.g., using phpMyAdmin or MySQL Workbench).
*   **Social login (optional)** – set up OAuth credentials for Google and/or GitHub in your provider consoles and add the corresponding keys/redirects to `.env.php` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, etc.).  
  The application uses the **`league/oauth2-client`** library to handle the OAuth flow.  

2.  **Configuration**:
    *   Open `db.php` and update the `$user` and `$pass` variables with your MySQL credentials (default is usually `root` and empty/blank for local development).

3.  **Running the Server**:
    *   Ensure your PHP server (XAMPP, WAMP, or built-in) is running.
    *   The API endpoints will be accessible at:
        *   `http://localhost/electrocom/backend/products.php`
        *   `http://localhost/electrocom/backend/auth.php`
        *   `http://localhost/electrocom/backend/orders.php`
    *   *Note: The exact URL depends on your server configuration and where you placed the project folder.*

## API Endpoints

### 1. Products (`GET /products.php`)
Returns a list of all products.

### 2. Authentication (`POST /auth.php`)
**Register:**
```json
{
  "action": "register",
  "name": "Your Name",
  "email": "email@example.com",
  "password": "yourpassword"
}
```

**Login:**
```json
{
  "action": "login",
  "email": "email@example.com",
  "password": "yourpassword"
}
```

### 3. Create Order (`POST /orders.php`)
Creates a new order.
```json
{
  "user_id": 1,
  "total_amount": 100.00,
  "items": [
    { "id": 1, "quantity": 2, "price": 50.00 }
  ],
  "shipping_address": "123 Main St",
  "payment_method": "card"
}
```
