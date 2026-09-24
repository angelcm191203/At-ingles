-- tabla de usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    numero_empleado VARCHAR(50) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'docente'
);

SELECT * FROM usuarios; -- consulta de usuarios 
delete from usuarios; -- borrar usuarios (uso por pruebas)
TRUNCATE TABLE usuarios RESTART IDENTITY; -- restablece id (uso por pruebas)