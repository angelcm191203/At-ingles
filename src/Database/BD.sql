-- Tabla de registro de usuarios 
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL, 
    
    -- recuperacion de contraseña 
    token_recuperacion VARCHAR(255) NULL,
    token_expiracion TIMESTAMP NULL,      
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

select * from usuarios