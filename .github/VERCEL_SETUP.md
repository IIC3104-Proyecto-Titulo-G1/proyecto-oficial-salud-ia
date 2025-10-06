# Configuración de Vercel para GitHub Actions

## Secrets necesarios en GitHub

Para que el CI/CD funcione correctamente con Vercel, necesitas configurar estos secrets en tu repositorio de GitHub:

### 1. Ir a GitHub Settings
- Ve a tu repositorio en GitHub
- Haz clic en **Settings** (Configuración)
- En el menú lateral, haz clic en **Secrets and variables** → **Actions**

### 2. Agregar los secrets

#### `VERCEL_TOKEN`
```bash
# Obtener el token desde Vercel CLI
npx vercel login
npx vercel tokens add "GitHub Actions CI" --scope your-team-name
```

#### `VERCEL_ORG_ID`
```bash
# En tu proyecto de Vercel, ve a Settings → General
# Copia el "Team ID" o "Personal Account ID"
```

#### `VERCEL_PROJECT_ID`
```bash
# En tu proyecto de Vercel, ve a Settings → General  
# Copia el "Project ID"
```

### 3. Verificar configuración

Los workflows se ejecutarán automáticamente cuando:
- **Push a main**: Despliega a producción
- **Pull Request**: Crea preview y ejecuta tests
- **Push a cualquier rama**: Ejecuta checks básicos

### 4. Comandos útiles

```bash
# Probar linter localmente
npm run lint

# Probar build localmente  
npm run build

# Verificar tipos TypeScript
npx tsc --noEmit
```

## Workflows incluidos

### `ci.yml` - Pipeline completo
- Ejecuta linter en Node 18.x y 20.x
- Verifica tipos TypeScript
- Hace build del proyecto
- Despliega preview en PRs
- Despliega a producción en main

### `dev.yml` - Checks rápidos
- Linter
- Verificación TypeScript
- Build test
- Comentario automático en PRs
