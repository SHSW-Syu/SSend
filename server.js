const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3003;

// 允许跨域请求
app.use(cors({
    origin: ['http://localhost:3000'],
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

// 处理订单
app.post('/receive', async (req, res) => {
    const { projectId, userId, totalPrice, items } = req.body;

    if (!projectId || !userId || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid order data' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 插入订单
        const [orderResult] = await connection.execute(
            'INSERT INTO gorder (project_id, user_id, total_price, status, cashier) VALUES (?, ?, ?, ?, ?)',
            [projectId, userId, totalPrice, 0, 0]
        );
        const orderId = orderResult.insertId;


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
}).on('error', (error) => {
    console.error('Server failed to start:', error);
});