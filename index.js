const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path'); // Importante para manejar rutas de archivos

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Configurar la carpeta actual para servir archivos estáticos (HTML, CSS, JS del front-end)
app.use(express.static(__dirname));

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'ciudad_limpia_db',
    password: 'valemar1831', // Tu contraseña de pgAdmin
    port: 5432,
});

// Configuración del servicio de correo (Nodemailer)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'tucorreo@gmail.com', 
        pass: 'tu_contraseña_de_aplicacion' 
    }
});

// Ruta principal para servir tu archivo HTML (Soluciona el error Cannot GET /)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Ruta para Registrar Usuarios y enviar correo de confirmación
app.post('/api/registro', async (req, res) => {
    const { email, password, nombre } = req.body;
    const token = Math.random().toString(36).substring(2);

    try {
        const query = `
            INSERT INTO usuarios (email, password, nombre, token) 
            VALUES ($1, $2, $3, $4) RETURNING id, email, nombre;
        `;
        await pool.query(query, [email, password, nombre, token]);

        const linkConfirmacion = `http://localhost:3000/api/confirmar?token=${token}`;
        await transporter.sendMail({
            from: 'tucorreo@gmail.com',
            to: email,
            subject: 'Confirma tu registro en EcoSTAN',
            html: `<p>Hola ${nombre}, haz clic en el siguiente enlace para confirmar tu cuenta:</p><a href="${linkConfirmacion}">Confirmar cuenta</a>`
        });

        res.json({ mensaje: 'Usuario registrado. Revisa tu correo para confirmar.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'El correo ya está registrado o hubo un error.' });
    }
});

// 2. Ruta para confirmar la cuenta mediante el token del correo
app.get('/api/confirmar', async (req, res) => {
    const { token } = req.query;
    try {
        const resultado = await pool.query(
            'UPDATE usuarios SET verificado = TRUE WHERE token = $1 RETURNING *',
            [token]
        );
        if (resultado.rowCount > 0) {
            res.send('<h1>¡Cuenta confirmada con éxito! Ya puedes iniciar sesión.</h1>');
        } else {
            res.status(400).send('<h1>Token inválido o expirado.</h1>');
        }
    } catch (error) {
        res.status(500).send('Error al confirmar la cuenta.');
    }
});

// 3. Ruta para Iniciar Sesión
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const resultado = await pool.query(
            'SELECT id, nombre, email, verificado FROM usuarios WHERE email = $1 AND password = $2',
            [email, password]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
        }

        const usuario = resultado.rows[0];

        res.json({ mensaje: 'Inicio de sesión exitoso', usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor al iniciar sesión.' });
    }
});

// 4. Ruta para guardar los reportes ciudadanos en tiempo real
app.post('/api/reportes', async (req, res) => {
    const { tipo, descripcion, direccion, lat, lng } = req.body;
    try {
        const query = `
            INSERT INTO reportes (tipo, descripcion, direccion, lat, lng) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        const values = [tipo, descripcion, direccion, lat, lng];
        const nuevoReporte = await pool.query(query, values);
        
        res.status(201).json({ 
            mensaje: 'Reporte guardado con éxito', 
            reporte: nuevoReporte.rows[0] 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al guardar el reporte' });
    }
});

// 5. Ruta para obtener todos los reportes para el mapa
app.get('/api/reportes', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM reportes ORDER BY id DESC');
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los reportes' });
    }
});

// Iniciar servidor usando el puerto dinámico de Render (o 3000 por defecto localmente)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
