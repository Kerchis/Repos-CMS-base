# Design tokens

Capa: primitivos → semánticos (`--color-primary`) → componente (`--button-bg`) → CSS de documento.

Presets en `/presets`:

- `marca.json` — paleta del brief (#D94E27, #512517, …)
- `editorial-mint.json` — referencia Swap

El admin guarda `meridian_tokens`. `TokenCompiler` inyecta `:root` en el front. Cambiar un token no recorre páginas.
