# Checklist §M (Fase 14)

Ejecutado el 2026-09-28 contra la instancia local. Lo marcado está verificado en código o con smoke PHP/HTTP.

## M.1 Páginas / builder

- [x] Crear página (nombre, slug únicos) — slug `qa-checklist!!!` → `qa-checklist`
- [x] Slug inválido se sanitiza
- [x] Agregar sección / Hero — constructor real
- [x] Heading, paragraph, image, button en catálogo + render
- [x] Persistir recargando (draft meta + autosave)
- [x] Tag H1–H6 (schema heading)
- [x] Alineación
- [x] Tipografía por breakpoint (size / weight / family → CSS compilado)
- [x] Color token y custom (inspector color)
- [x] Padding/margin por breakpoint
- [x] Imagen vía `wp.media`
- [x] Alt text en render
- [x] Botón texto/URL/target
- [x] URL inválida → «El enlace introducido no es válido.»
- [x] Reordenar ↑↓
- [x] Duplicar (IDs nuevos via `regen`)
- [x] Ocultar: no en público, sí en preview
- [x] Eliminar pide confirmación (Cancelar no borra)
- [x] Draft no publica
- [x] Preview nonce + cap; anónimo no ve draft
- [x] Publicar escribe permalink + cache HTML
- [x] Autosave / historial / restaurar
- [x] Duplicar página
- [x] Página padre
- [x] Plantilla e insertar
- [x] Global / override / desvincular

## M.2 Design system

- [x] `--color-primary` en `:root` (tokens)
- [x] `#D94E27` ausente en `assets/css/components.css`
- [x] Familias y roles tipográficos en Apariencia
- [x] Radius / max-width tokens
- [x] Preset Editorial Mint (`#a3fda7`) y vuelta a Marca (`#D94E27`)
- [x] Exportar / importar tokens JSON
- [x] Logo y favicon (identidad + `<head>`)

## M.3 Responsive

- [x] Preview D 1280 / T 768 / M 390 (mismo HTML)
- [x] Columns / cards-grid 4/2/1 compilados
- [x] Padding distinto por breakpoint
- [x] Ocultar en mobile (`m-hide-*`)
- [x] Breakpoints desde tokens

## M.4 Blog

- [x] Crear, draft, publish, programar (`datetime-local`)
- [x] Categorías, tags (crear etiqueta), destacada, extracto
- [x] HTML semántico (toolbar P/H2/H3/listas/citas; kses, sin script)
- [x] `home.php` / `single.php` / archive / search / related / paginación
- [x] SEO title/description en meta del post

## M.5 Nav / chrome

- [x] Menús header/footer
- [x] Sticky, logo, CTA
- [x] Footer columnas, copyright, sociales
- [x] Toggle mobile `aria-expanded`

## M.6 Formularios / maps

- [x] Contacto: nonce + honeypot + `wp_mail`
- [x] Map URL mala → «La URL introducida no es válida.»
- [x] Map buena → iframe sandbox

## M.7 Seguridad / permisos

- [x] Editor (`editor` / `editor123`) **no** `meridian_manage` (tokens)
- [x] Autor (`autor` / `autor123`) no edita páginas KRG CMS
- [x] REST sin nonce → 401
- [x] Script en heading se escapa
- [x] Preview anónimo bloqueado

## M.8 Calidad

- [x] Errores de API en español, sin stack al visitante
- [x] Skip link, labels, focus en CSS base
- [x] JS de maps solo si hay mapa
- [x] Import/export JSON (páginas regeneran IDs)

## Cuentas

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | admin123 | Administrador |
| editor | editor123 | Editor |
| autor | autor123 | Autor |
