const express = require('express');
const mysql = require('mysql2/promise'); // 用 promise 版本
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3003;

// 允许跨域请求
app.use(cors({
    origin: ['http://localhost:3000'],
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // 解析表单数据

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

// 处理表单提交
app.post('/submit', async (req, res) => {
    const { project_name, project_floor, project_color, product_count, topping_count } = req.body;

    if (!project_name || !project_floor || !project_color || !product_count || !topping_count) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 插入项目信息
        const [projectResult] = await connection.execute(
            'INSERT INTO project (project_name, project_floor, project_color) VALUES (?, ?, ?)',
            [project_name, project_floor, project_color]
        );
        const project_id = projectResult.insertId;

        // 插入产品信息
        for (let i = 1; i <= product_count; i++) {
            const product_name = req.body[`product_name_${i}`];
            const product_price = req.body[`product_price_${i}`];
            const topping_group = req.body[`topping_group_${i}`];
            const topping_limit = req.body[`topping_limit_${i}`];

            await connection.execute(
                'INSERT INTO product (project_id, product_name, product_price, topping_group, topping_limit) VALUES (?, ?, ?, ?, ?)',
                [project_id, product_name, product_price, topping_group, topping_limit]
            );
        }

        // 插入配料信息
        for (let i = 1; i <= topping_count; i++) {
            const topping_name = req.body[`topping_name_${i}`];
            const topping_price = req.body[`topping_price_${i}`];
            const topping_group = req.body[`topping_group_${i}`];

            await connection.execute(
                'INSERT INTO topping (project_id, topping_name, topping_price, topping_group) VALUES (?, ?, ?, ?)',
                [project_id, topping_name, topping_price, topping_group]
            );
        }

        await connection.commit();
        res.json({ success: true, project_id });
    } catch (error) {
        await connection.rollback();
        console.error('Error processing form submission:', error);
        res.status(500).json({ error: 'Failed to process form submission' });
    } finally {
        connection.release();
    }
});

// 处理订单
app.post('/receive', async (req, res) => {
    const { project_id, user_id, total_price, items } = req.body;

    if (!project_id || !user_id) {
        return res.status(400).json({ error: 'Invalid order data' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 插入订单
        const [orderResult] = await connection.execute(
            'INSERT INTO gorder (project_id, user_id, total_price, status, cashier) VALUES (?, ?, ?, ?, ?)',
            [project_id, user_id, total_price, 0, 0]
        );
        const order_id = orderResult.insertId;

        const orderDetailsQuery =
            'INSERT INTO item (order_id, product_id, topping_id_1, topping_id_2, quantity) VALUES ?';
        const orderDetailsValues = items.map(item => [
            order_id,
            item.product_id,
            item.topping_id_1 || null,
            item.topping_id_2 || null,
            item.quantity,
        ]);

        await connection.query(orderDetailsQuery, [orderDetailsValues]);

        await connection.commit();
        res.json({ success: true, order_id });
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