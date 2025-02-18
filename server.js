const express = require('express');
const mysql = require('mysql2/promise'); // 用 promise 版本
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3003;

// 允许跨域请求
app.use(cors({
    origin:  ['http://localhost:3000'],
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type'
}));
app.use(bodyParser.json());

// 创建 MySQL 连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 获取商品信息
// 处理订单
app.post('/receive', async (req, res) => {
    const { projectId, userId, totalPrice, items } = req.body;

    if (!projectId || !userId || !items || items.length === 0) {
        return res.status(400).json({ error: 'Invalid order data' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 插入订单
        const [orderResult] = await connection.execute(
            'INSERT INTO gorder (project_id, user_id, total_price, status, cashier) VALUES (?, ?, ?, ?, ?)',
            [userId, totalPrice, projectId, 0, 0]
        );
        const orderId = orderResult.insertId;

        // 插入订单详情
        const orderDetailsQuery =
            'INSERT INTO item (order_id, product_id, topping1_id, topping2_id, quantity) VALUES ?';
        const orderDetailsValues = items.map(item => [
            orderId,
            item.productId,
            item.topping1Id || null,
            item.topping2Id || null,
            item.quantity
        ]);

        await connection.query(orderDetailsQuery, [orderDetailsValues]);

        await connection.commit();
        res.json({ success: true, orderId });
    } catch (error) {
        await connection.rollback();
        console.error('Error processing order:', error);
        res.status(500).json({ error: 'Failed to process order' });
    } finally {
        connection.release();
    }
});
// 启动服务器
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
});