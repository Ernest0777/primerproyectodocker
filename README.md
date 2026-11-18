# Tarea 3 — Aplicación Node.js

Autor: Ernesto Guillermo Hernández Ocón.

Servidor HTTP en Node.js 24 que responde `Hola mundo,hola mundo x2` en `/` y
`{"status":"ok"}` en `/health`. Usa el puerto `PORT` o 3000 y no requiere base
de datos ni dependencias externas. La infraestructura AWS está en `../iac`.
El repositorio original se llama `primerproyectodocker`; en la entrega es `app`.

## Ejecutar localmente

Con Docker Desktop abierto en modo Linux, desde esta carpeta:

```powershell
docker compose up -d --build
```

Abre `http://localhost:3000` o `http://localhost:3000/health`.
Para ver logs: `docker compose logs app`. Para detener: `docker compose down`.
Si el puerto está ocupado, cambia el puerto de la izquierda en `docker-compose.yml`.

Sin Docker, instala Node.js 24 y ejecuta desde `app`:

```powershell
cd src
npm start
```

Ctrl+C detiene el servidor. Para las pruebas, en otra terminal desde `app/src`:

```powershell
npm test
```

Las dos pruebas verifican el saludo y `/health`; no requieren `npm install`.
El código está en `src/index.js`, las pruebas en `test/app.test.js` y la imagen
se define en `dockerfile`, con Node 24 Alpine y usuario `node`.

## Pipeline

**Ubicación: `.github/workflows/main.yml` (GitHub Actions).** Se ejecuta al hacer
push a `main` o manualmente desde Actions → Test, Build and Deploy to ECS.
Publica el contenido de `app` como raíz de su propio repositorio, incluida `.github`.

El pipeline ejecuta pruebas, construye la imagen Linux amd64, publica los tags
del commit y `latest` en ECR, actualiza ECS y verifica que el despliegue termine.

En Settings → Secrets and variables → Actions, configura estos **Secrets**:

- `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`.
- `AWS_SESSION_TOKEN` solo para credenciales temporales, renovándolo cuando expire.

La identidad necesita permisos para publicar en ECR y actualizar/consultar ECS.
Después del primer apply, `terraform output -raw github_actions_policy` en `iac`
devuelve una política con los ARN correspondientes para asociarla a esa identidad.
No guardes credenciales en el código.

Las siguientes **Variables** son opcionales y deben coincidir con Terraform:

| Variable | Valor predeterminado |
|---|---|
| `AWS_REGION` | `us-east-2` |
| `ECR_REPOSITORY` | `primerproyectodocker` |
| `ECS_CLUSTER` | `iac-dev-ecs` |
| `ECS_SERVICE` | `iac-dev-app` |

## Despliegue en AWS

Primero sigue `../iac/README.md`. El primer `terraform apply` crea ECR, construye
y publica esta app, y después inicia ECS. El pipeline se usa para los cambios
posteriores; fallará si aún no existe la infraestructura. No ejecutarlo al mismo
tiempo que un apply que publique imágenes.

La URL pública es el output `ecs_url`. El ALB recibe HTTP en 80 y envía al
contenedor en 3000. Los logs están en CloudWatch, `/ecs/<project_name>`.
Las pruebas locales no necesitan credenciales AWS. Las verificaciones realizadas
están documentadas en `../iac/VERIFICATION.md`.
