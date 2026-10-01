# KRG CMS

Tema WordPress autosuficiente: **CMS + constructor visual + design system**.  
El administrador construye páginas, blog, identidad y navegación **sin PHP, HTML, CSS ni JS**.

Sin Elementor, Divi, WPBakery ni Gutenberg como motor de páginas.

Versión **1.13.16**. Requiere WordPress 6.4+ y PHP 8.1+.

---

## Instalar

1. Copia la carpeta **`krg-cms`** a `wp-content/themes/krg-cms/` (sin espacios en el nombre de carpeta).
2. **Apariencia → Temas → Activar KRG CMS**.
3. **Ajustes → Enlaces permanentes → Nombre de la entrada → Guardar**.
4. Entra a **KRG CMS** en el menú de WordPress (hace falta un administrador).

---

## Qué incluye

- Constructor visual (secciones, filas 12 columnas, layouts anidados).
- Árbol: renombrar, arrastrar, flechas, mover entre columnas.
- Guardar (POST) + autosave + publicar. Caché borrable en Configuración.
- Imagen y galería (biblioteca, fill, parallax).
- Video (enlace o archivo, sin visor descargable).
- Everest Forms embebido + formulario de contacto propio.
- Google Maps, cards con picker de imagen, alinear/distribuir.
- Tokens CSS (`var(--color-primary)`), header/footer visual, menús.
- Blog, SEO, usuarios y permisos por rol desde el CMS.

Especificación para replicar o adaptar a otra marca: `docs/PROMPT-REPLICAR-TEMA.md`.

---

## Añadir un componente (desarrollador)

1. Schema en `core/components/Catalog.php`.
2. HTML en `core/render/ComponentRenders.php`.
3. Solo `var(--token)`, nunca hex de marca.

---

## Licencia

GNU GPL v2 o posterior (como WordPress).
