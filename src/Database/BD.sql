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
--tabla grupos donde se guarda la informacion del excel 
CREATE TABLE grupos (
    id SERIAL PRIMARY KEY,
    grupo VARCHAR(50),
    docente VARCHAR(150),
    horario VARCHAR(200),
    espacio VARCHAR(50),
    asignatura VARCHAR(100),
    promedio NUMERIC(5,2),
    fecha_subida TIMESTAMP DEFAULT NOW()
);