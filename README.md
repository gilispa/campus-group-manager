# Backend local de gestion de grupos estudiantiles

Base backend para una app desktop local-first usando Node.js, TypeScript, Prisma, SQLite y arquitectura compatible con Electron.

## Stack

- Node.js
- TypeScript estricto
- Prisma ORM
- SQLite
- bcrypt
- Arquitectura preparada para Electron

## Estructura

```text
src/
├── config/
├── database/
├── main/
├── repositories/
├── services/
├── types/
├── utils/
└── validation/

prisma/
data/
├── database/
└── uploads/
    ├── students/
    └── groups/
```

## Modelos incluidos

- `Student`
- `Group`
- `Category`
- `Role`
- `StudentGroup`
- `AdminSettings`

## Reglas principales

- La base de datos corre totalmente local con SQLite.
- Solo existe un admin.
- La contrasena del admin se guarda con `bcrypt`.
- Las imagenes no se guardan en SQLite, solo se guardan rutas locales.
- El historial de participacion se conserva en `StudentGroup` usando `active` y `leftAt`.

## Configuracion

La DB se define en `.env`:

```env
DATABASE_URL="file:../data/database/app.db"
```

Opcional para Electron o entornos empaquetados:

```env
APP_DATA_DIR="C:/ruta/personalizada/data"
```

Rutas esperadas para archivos:

- fotos de estudiantes: `/uploads/students/...`
- logos de grupos: `/uploads/groups/...`

## Instalar

```bash
npm install
```

## Generar cliente Prisma

```bash
npm run prisma:generate
```

## Crear migracion inicial

```bash
npm run prisma:migrate
```

## Ejecutar ejemplos backend

```bash
npm run examples
```

## Ejecutar demo desktop con Electron + React

```bash
npm run dev
```

Esto inicia:

- compilacion backend/electron en watch
- servidor Vite para React
- ventana Electron conectada al backend local

Si no abre la ventana, valida:

- que `dist/electron/main.js` y `dist/electron/preload.js` existan
- que el puerto `5173` este libre
- que no haya errores en la terminal de `tsc --watch`

## Compilar app desktop y renderer

```bash
npm run build
```

## Ejecutar app desktop ya compilada

```bash
npm run start:desktop
```

## Deploy Windows (instalador + portable)

```bash
npm run dist:win
```

Los artefactos se generan en `release/`.

Si aparece un error de `Cannot create symbolic link` al ejecutar `electron-builder`:

- abre la terminal como Administrador, o
- habilita `Developer Mode` en Windows para permitir symlinks sin privilegios elevados.

## Compilar TypeScript

```bash
npm run build:backend
```

## Servicios disponibles

- `CategoryService`
- `RoleService`
- `StudentService`
- `GroupService`
- `StudentGroupService`
- `AdminAuthService`
- `BackupService`
- `MetaService`

Se pueden obtener desde:

```ts
import { bootstrapDatabase, createBackendServices } from "./src/main";

await bootstrapDatabase();

const services = createBackendServices();
```

## Ejemplos de uso

### Crear categoria

```ts
const category = await services.categoryService.createCategory({
  name: "Tecnologia",
  description: "Clubes de tecnologia"
});
```

### Crear rol

```ts
const role = await services.roleService.createRole({
  name: "Presidente",
  description: "Lider del grupo"
});
```

### Crear estudiante

```ts
const student = await services.studentService.createStudent({
  nombre: "Ana Lopez",
  matricula: "A001",
  nivel: "PROFESIONAL",
  carrera: "Ingenieria Industrial",
  generacion: 2024,
  foto: "/uploads/students/ana.png"
});
```

### Crear grupo

```ts
const group = await services.groupService.createGroup({
  nombre: "Club de Robotica",
  descripcion: "Participacion en concursos",
  logo: "/uploads/groups/robotica.png",
  categoryId: category.id
});
```

### Agregar estudiante a grupo

```ts
await services.studentGroupService.addStudentToGroup({
  studentId: student.id,
  groupId: group.id,
  roleId: role.id
});
```

### Remover estudiante de grupo sin borrar historial

```ts
await services.studentGroupService.removeStudentFromGroup({
  studentId: student.id,
  groupId: group.id
});
```

### Configurar password inicial del admin

```ts
await services.adminAuthService.setInitialPassword({
  password: "admin1234"
});
```

### Login del admin

```ts
await services.adminAuthService.loginAdmin({
  password: "admin1234"
});
```

### Exportar base de datos

```ts
await services.backupService.exportDatabase("C:/respaldos/grupos-backup.db");
```

### Importar base de datos

```ts
await services.backupService.importDatabase("C:/respaldos/grupos-backup.db");
```

## Notas para Electron

- La capa backend es local y no depende de servidor web.
- Los servicios pueden exponerse mas adelante via `ipcMain.handle` desde Electron.
- La separacion por `repositories` y `services` facilita conectar React despues sin tocar la logica de negocio.
- Para produccion en Electron se recomienda definir `APP_DATA_DIR` con una ruta basada en `app.getPath("userData")`.

## Demo frontend incluido

La app demo ya incluye pantallas para probar como usuario:

- login / configuracion inicial del admin
- dashboard con resumen general
- CRUD de categorias
- CRUD de roles
- CRUD de estudiantes
- CRUD de grupos
- participaciones estudiante-grupo
- exportacion e importacion de SQLite

La UI del demo usa Electron IPC seguro via `preload`, no accede directamente a Prisma ni a Node desde React.

## Escalabilidad futura

La base queda preparada para agregar despues:

- estadisticas
- dashboard local
- import/export avanzado
- calculo de semestre desde `generacion`
- integracion con Electron Builder
