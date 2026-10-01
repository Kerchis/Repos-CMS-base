# Componentes

Cada componente declara schema (campos, defaults, categoría) en `core/components/Catalog.php` y HTML en `core/render/ComponentRenders.php`.

```php
\Meridian\Components\Registry::register([
  'slug' => 'hero',
  'name' => 'Hero',
  'fields' => [ /* ... */ ],
  'defaults' => [ /* ... */ ],
]);
```

El inspector del constructor se genera del schema. No se aceptan props fuera del schema (sanitizer).

Estilos por nodo: `styles.desktop|tablet|mobile` con allowlist CSS. Valores de color preferiblemente `var(--color-primary)` o `{mode:token, token:color.primary}`.
