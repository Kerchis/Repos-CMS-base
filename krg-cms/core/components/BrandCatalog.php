<?php
/**
 * Component schemas derived from the reference design system.
 *
 * Estos componentes NO contienen copy real: solo placeholders en `defaults`.
 * Cada propiedad visible en las referencias se expone como campo editable para
 * que el constructor visual pueda modificarla sin tocar código.
 *
 * @package Meridian
 */

namespace Meridian\Components;

defined( 'ABSPATH' ) || exit;

class BrandCatalog {

	public static function all(): array {
		return array_merge(
			self::display(),
			self::heroes(),
			self::collections(),
			self::editorial(),
			self::modules()
		);
	}

	private static function f( string $key, string $type, string $group, string $label, array $extra = [] ): array {
		return array_merge(
			[
				'key'   => $key,
				'type'  => $type,
				'group' => $group,
				'label' => $label,
			],
			$extra
		);
	}

	/** Campos de columnas responsive compartidos. */
	private static function cols( int $d = 3, int $t = 2, int $m = 1, int $max = 6 ): array {
		return [
			self::f( 'desktop', 'number', 'responsive', __( 'Columnas desktop', 'meridian' ), [ 'min' => 1, 'max' => $max, 'default' => $d ] ),
			self::f( 'tablet', 'number', 'responsive', __( 'Columnas tablet', 'meridian' ), [ 'min' => 1, 'max' => 4, 'default' => $t ] ),
			self::f( 'mobile', 'number', 'responsive', __( 'Columnas móvil', 'meridian' ), [ 'min' => 1, 'max' => 3, 'default' => $m ] ),
		];
	}

	/** Campos de cabecera de sección compartidos (eyebrow + título + enlace). */
	private static function head_fields(): array {
		return [
			self::f( 'eyebrow', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
			self::f( 'title', 'textarea', 'content', __( 'Título', 'meridian' ) ),
			self::f( 'titleTag', 'htmlTag', 'content', __( 'Etiqueta del título', 'meridian' ), [ 'options' => [ 'h1', 'h2', 'h3', 'h4', 'p' ] ] ),
			self::f( 'tracking', 'select', 'design', __( 'Tracking del título', 'meridian' ), [ 'options' => [ 'wide', 'normal', 'tight' ] ] ),
			self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
			self::f( 'linkText', 'text', 'content', __( 'Texto del enlace', 'meridian' ) ),
			self::f( 'linkUrl', 'url', 'content', __( 'URL del enlace', 'meridian' ) ),
		];
	}

	private static function spacing_fields(): array {
		return [
			self::f( 'padTop', 'number', 'spacing', __( 'Espacio superior (px)', 'meridian' ), [ 'min' => 0, 'max' => 240 ] ),
			self::f( 'padBottom', 'number', 'spacing', __( 'Espacio inferior (px)', 'meridian' ), [ 'min' => 0, 'max' => 240 ] ),
		];
	}

	/* ------------------------------------------------------------------ */
	/* Tipografía display                                                  */
	/* ------------------------------------------------------------------ */

	private static function display(): array {
		return [
			[
				'slug'        => 'display-type',
				'name'        => __( 'Título display', 'meridian' ),
				'description' => __( 'Titular en mayúsculas con tracking amplio y revelado por letra al hacer scroll.', 'meridian' ),
				'category'    => 'text',
				'icon'        => 'heading',
				'defaults'    => [
					'eyebrow'   => '',
					'text'      => 'TITULAR DISPLAY',
					'tag'       => 'h2',
					'size'      => 'xl',
					'tracking'  => 'wide',
					'align'     => 'center',
					'reveal'    => 'letters',
					'maxWidth'  => 0,
					'colorMode' => 'inherit',
				],
				'fields'      => [
					self::f( 'eyebrow', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
					self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
					self::f( 'tag', 'htmlTag', 'content', __( 'Etiqueta', 'meridian' ), [ 'options' => [ 'h1', 'h2', 'h3', 'h4', 'p' ] ] ),
					self::f( 'size', 'select', 'design', __( 'Tamaño', 'meridian' ), [ 'options' => [ 'display', 'xl', 'lg', 'md', 'sm' ] ] ),
					self::f( 'tracking', 'select', 'design', __( 'Tracking', 'meridian' ), [ 'options' => [ 'wide', 'wider', 'normal', 'tight' ] ] ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
					self::f( 'reveal', 'select', 'design', __( 'Animación de entrada', 'meridian' ), [ 'options' => [ 'letters', 'fade', 'none' ] ] ),
					self::f( 'colorMode', 'select', 'colors', __( 'Color', 'meridian' ), [ 'options' => [ 'inherit', 'primary', 'secondary', 'background', 'custom' ] ] ),
					self::f( 'color', 'color', 'colors', __( 'Color personalizado', 'meridian' ) ),
					self::f( 'maxWidth', 'number', 'layout', __( 'Ancho máximo (px, 0 = sin límite)', 'meridian' ), [ 'min' => 0, 'max' => 1600 ] ),
				],
			],
			[
				'slug'        => 'marquee',
				'name'        => __( 'Marquesina', 'meridian' ),
				'description' => __( 'Banda horizontal infinita con texto repetido y separador icónico.', 'meridian' ),
				'category'    => 'other',
				'icon'        => 'marquee',
				'defaults'    => [
					'items'     => [
						[ 'text' => 'HECHO CON CUIDADO', 'url' => '' ],
						[ 'text' => 'TRAZABILIDAD REAL', 'url' => '' ],
						[ 'text' => 'ORIGEN VERIFICADO', 'url' => '' ],
					],
					'separator' => 'dot',
					'iconId'    => 0,
					'speed'     => 40,
					'direction' => 'left',
					'variant'   => 'solid',
					'size'      => 'md',
					'pauseHover'=> true,
				],
				'fields'      => [
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Textos', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'text', 'text', 'content', __( 'Texto', 'meridian' ) ),
								self::f( 'url', 'url', 'content', __( 'Enlace (opcional)', 'meridian' ) ),
							],
						]
					),
					self::f( 'separator', 'select', 'design', __( 'Separador', 'meridian' ), [ 'options' => [ 'dot', 'star', 'slash', 'image', 'none' ] ] ),
					self::f( 'iconId', 'image', 'content', __( 'Icono separador', 'meridian' ) ),
					self::f( 'variant', 'select', 'design', __( 'Variante', 'meridian' ), [ 'options' => [ 'solid', 'outline', 'plain', 'dark' ] ] ),
					self::f( 'size', 'select', 'design', __( 'Tamaño', 'meridian' ), [ 'options' => [ 'sm', 'md', 'lg', 'xl' ] ] ),
					self::f( 'speed', 'number', 'design', __( 'Duración del ciclo (s)', 'meridian' ), [ 'min' => 5, 'max' => 180 ] ),
					self::f( 'direction', 'select', 'design', __( 'Dirección', 'meridian' ), [ 'options' => [ 'left', 'right' ] ] ),
					self::f( 'pauseHover', 'toggle', 'design', __( 'Pausar al pasar el cursor', 'meridian' ) ),
				],
			],
			[
				'slug'        => 'preloader',
				'name'        => __( 'Pantalla de carga', 'meridian' ),
				'description' => __( 'Overlay de bienvenida con contador y claim de marca.', 'meridian' ),
				'category'    => 'other',
				'icon'        => 'loader',
				'defaults'    => [
					'label'    => 'CARGANDO…',
					'claim'    => 'BIENVENIDO.',
					'imageId'  => 0,
					'duration' => 1600,
					'once'     => true,
					'showCount'=> true,
				],
				'fields'      => [
					self::f( 'label', 'text', 'content', __( 'Etiqueta', 'meridian' ) ),
					self::f( 'claim', 'text', 'content', __( 'Claim', 'meridian' ) ),
					self::f( 'imageId', 'image', 'content', __( 'Imagen / logotipo', 'meridian' ) ),
					self::f( 'duration', 'number', 'design', __( 'Duración (ms)', 'meridian' ), [ 'min' => 400, 'max' => 6000 ] ),
					self::f( 'showCount', 'toggle', 'design', __( 'Mostrar porcentaje', 'meridian' ) ),
					self::f( 'once', 'toggle', 'advanced', __( 'Mostrar solo una vez por sesión', 'meridian' ) ),
				],
			],
		];
	}

	/* ------------------------------------------------------------------ */
	/* Heroes                                                              */
	/* ------------------------------------------------------------------ */

	private static function heroes(): array {
		return [
			[
				'slug'        => 'brand-hero',
				'name'        => __( 'Hero de marca', 'meridian' ),
				'description' => __( 'Hero a sangre con titular display, antetítulo, subtítulos y botones. Variantes: centrado, izquierda y partido.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'hero',
				'defaults'    => [
					'variant'     => 'center',
					'eyebrow'     => '',
					'title'       => 'TITULAR PRINCIPAL',
					'subtitle'    => 'SUBTÍTULO DE APOYO.',
					'subtitle2'   => '',
					'text'        => '',
					'buttons'     => [
						[ 'text' => 'EMPEZAR', 'url' => '#', 'variant' => 'primary' ],
					],
					'imageId'     => 0,
					'mobileImageId' => 0,
					'overlay'     => 30,
					'height'      => 'tall',
					'theme'       => 'light',
					'scrollHint'  => true,
				],
				'fields'      => [
					self::f( 'variant', 'select', 'design', __( 'Variante', 'meridian' ), [ 'options' => [ 'center', 'left', 'split', 'compact' ] ] ),
					self::f( 'eyebrow', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
					self::f( 'title', 'textarea', 'content', __( 'Titular', 'meridian' ) ),
					self::f( 'subtitle', 'textarea', 'content', __( 'Subtítulo', 'meridian' ) ),
					self::f( 'subtitle2', 'textarea', 'content', __( 'Segundo subtítulo', 'meridian' ) ),
					self::f( 'text', 'textarea', 'content', __( 'Párrafo', 'meridian' ) ),
					self::f(
						'buttons',
						'repeater',
						'content',
						__( 'Botones', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'text', 'text', 'content', __( 'Texto', 'meridian' ) ),
								self::f( 'url', 'url', 'content', __( 'URL', 'meridian' ) ),
								self::f( 'variant', 'select', 'design', __( 'Estilo', 'meridian' ), [ 'options' => [ 'primary', 'secondary', 'outline', 'ghost' ] ] ),
								self::f( 'target', 'select', 'content', __( 'Destino', 'meridian' ), [ 'options' => [ '_self', '_blank' ] ] ),
							],
						]
					),
					self::f( 'imageId', 'image', 'content', __( 'Imagen de fondo', 'meridian' ) ),
					self::f( 'mobileImageId', 'image', 'responsive', __( 'Imagen en móvil', 'meridian' ) ),
					self::f( 'overlay', 'number', 'design', __( 'Veladura (%)', 'meridian' ), [ 'min' => 0, 'max' => 90 ] ),
					self::f( 'height', 'select', 'design', __( 'Altura', 'meridian' ), [ 'options' => [ 'full', 'tall', 'medium', 'short' ] ] ),
					self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'light', 'dark', 'cream', 'forest' ] ] ),
					self::f( 'scrollHint', 'toggle', 'design', __( 'Indicador de scroll', 'meridian' ) ),
				],
			],
			[
				'slug'        => 'split-feature',
				'name'        => __( 'Bloque partido', 'meridian' ),
				'description' => __( 'Imagen + contenido editorial con antetítulo, titular display, texto y CTA.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'split',
				'defaults'    => [
					'eyebrow'   => '',
					'title'     => 'TITULAR DE SECCIÓN',
					'titleTag'  => 'h2',
					'text'      => '',
					'linkText'  => '',
					'linkUrl'   => '',
					'imageId'   => 0,
					'imageSide' => 'left',
					'imageShape'=> 'rounded',
					'ratio'     => 'balanced',
					'theme'     => 'cream',
					'tracking'  => 'wide',
					'align'     => 'left',
				],
				'fields'      => [
					self::f( 'eyebrow', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
					self::f( 'title', 'textarea', 'content', __( 'Titular', 'meridian' ) ),
					self::f( 'titleTag', 'htmlTag', 'content', __( 'Etiqueta del titular', 'meridian' ), [ 'options' => [ 'h1', 'h2', 'h3', 'p' ] ] ),
					self::f( 'text', 'richtext', 'content', __( 'Texto', 'meridian' ) ),
					self::f( 'linkText', 'text', 'content', __( 'Texto del botón', 'meridian' ) ),
					self::f( 'linkUrl', 'url', 'content', __( 'URL del botón', 'meridian' ) ),
					self::f( 'imageId', 'image', 'content', __( 'Imagen', 'meridian' ) ),
					self::f( 'imageSide', 'select', 'design', __( 'Lado de la imagen', 'meridian' ), [ 'options' => [ 'left', 'right' ] ] ),
					self::f( 'imageShape', 'select', 'design', __( 'Forma', 'meridian' ), [ 'options' => [ 'rounded', 'arch', 'square', 'circle' ] ] ),
					self::f( 'ratio', 'select', 'layout', __( 'Proporción', 'meridian' ), [ 'options' => [ 'balanced', 'image-wide', 'text-wide' ] ] ),
					self::f( 'tracking', 'select', 'design', __( 'Tracking del titular', 'meridian' ), [ 'options' => [ 'wide', 'normal', 'tight' ] ] ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación del texto', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
					self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'cream', 'surface', 'forest', 'light' ] ] ),
				],
			],
			[
				'slug'        => 'statement-cta',
				'name'        => __( 'CTA display', 'meridian' ),
				'description' => __( 'Llamada a la acción a pantalla completa con titular display e iconos intercalados.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'cta',
				'defaults'    => [
					'eyebrow'   => '',
					'title'     => 'UN TITULAR QUE INVITA A ACTUAR',
					'text'      => '',
					'buttonText'=> 'IR',
					'buttonUrl' => '#',
					'iconId'    => 0,
					'iconCount' => 3,
					'imageId'   => 0,
					'theme'     => 'forest',
					'overlay'   => 40,
					'align'     => 'center',
				],
				'fields'      => [
					self::f( 'eyebrow', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
					self::f( 'title', 'textarea', 'content', __( 'Titular', 'meridian' ) ),
					self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
					self::f( 'buttonText', 'text', 'content', __( 'Texto del botón', 'meridian' ) ),
					self::f( 'buttonUrl', 'url', 'content', __( 'URL del botón', 'meridian' ) ),
					self::f( 'iconId', 'image', 'content', __( 'Icono decorativo', 'meridian' ) ),
					self::f( 'iconCount', 'number', 'design', __( 'Iconos antes del titular', 'meridian' ), [ 'min' => 0, 'max' => 6 ] ),
					self::f( 'imageId', 'image', 'content', __( 'Imagen de fondo', 'meridian' ) ),
					self::f( 'overlay', 'number', 'design', __( 'Veladura (%)', 'meridian' ), [ 'min' => 0, 'max' => 90 ] ),
					self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'forest', 'cream', 'dark', 'light' ] ] ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
				],
			],
		];
	}

	/* ------------------------------------------------------------------ */
	/* Colecciones                                                         */
	/* ------------------------------------------------------------------ */

	private static function collections(): array {
		$card_item = [
			self::f( 'title', 'text', 'content', __( 'Título', 'meridian' ) ),
			self::f( 'category', 'text', 'content', __( 'Categoría / etiqueta', 'meridian' ) ),
			self::f( 'text', 'textarea', 'content', __( 'Descripción', 'meridian' ) ),
			self::f( 'imageId', 'image', 'content', __( 'Imagen', 'meridian' ) ),
			self::f( 'alt', 'text', 'content', __( 'Texto alternativo', 'meridian' ) ),
			self::f( 'linkText', 'text', 'content', __( 'Texto del enlace', 'meridian' ) ),
			self::f( 'url', 'url', 'content', __( 'URL', 'meridian' ) ),
			self::f( 'badge', 'text', 'content', __( 'Badge', 'meridian' ) ),
		];

		return [
			[
				'slug'        => 'product-rail',
				'name'        => __( 'Carril de productos', 'meridian' ),
				'description' => __( 'Carrusel horizontal de tarjetas de producto con cabecera y enlace “ver más”.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'rail',
				'defaults'    => [
					'eyebrow'   => '',
					'title'     => 'DESTACADOS',
					'titleTag'  => 'h2',
					'tracking'  => 'normal',
					'align'     => 'center',
					'linkText'  => '',
					'linkUrl'   => '',
					'desktop'   => 4,
					'tablet'    => 2,
					'mobile'    => 1,
					'layout'    => 'rail',
					'cardStyle' => 'soft',
					'arrows'    => true,
					'theme'     => 'cream',
					'items'     => [
						[ 'title' => 'PRODUCTO UNO', 'linkText' => 'Ver más', 'url' => '#', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'badge' => '' ],
						[ 'title' => 'PRODUCTO DOS', 'linkText' => 'Ver más', 'url' => '#', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'badge' => '' ],
						[ 'title' => 'PRODUCTO TRES', 'linkText' => 'Ver más', 'url' => '#', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'badge' => '' ],
					],
				],
				'fields'      => array_merge(
					self::head_fields(),
					self::cols( 4, 2, 1, 6 ),
					[
						self::f( 'layout', 'select', 'design', __( 'Disposición', 'meridian' ), [ 'options' => [ 'rail', 'grid' ] ] ),
						self::f( 'cardStyle', 'select', 'design', __( 'Estilo de tarjeta', 'meridian' ), [ 'options' => [ 'soft', 'outline', 'bare' ] ] ),
						self::f( 'arrows', 'toggle', 'design', __( 'Flechas de navegación', 'meridian' ) ),
						self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'cream', 'surface', 'forest', 'light' ] ] ),
						self::f( 'items', 'repeater', 'content', __( 'Productos', 'meridian' ), [ 'itemFields' => $card_item ] ),
					]
				),
			],
			[
				'slug'        => 'collection-grid',
				'name'        => __( 'Rejilla de colección', 'meridian' ),
				'description' => __( 'Rejilla de tarjetas con categoría, título e imagen. Sirve para recetas, artículos o fichas.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'grid',
				'defaults'    => [
					'eyebrow'   => '',
					'title'     => 'COLECCIÓN',
					'titleTag'  => 'h2',
					'tracking'  => 'normal',
					'align'     => 'center',
					'linkText'  => '',
					'linkUrl'   => '',
					'desktop'   => 3,
					'tablet'    => 2,
					'mobile'    => 1,
					'cardStyle' => 'overlay',
					'ratio'     => 'portrait',
					'theme'     => 'cream',
					'items'     => [
						[ 'category' => 'CATEGORÍA', 'title' => 'TÍTULO DE LA TARJETA', 'url' => '#', 'imageId' => 0, 'alt' => '', 'text' => '', 'linkText' => '', 'badge' => '' ],
						[ 'category' => 'CATEGORÍA', 'title' => 'TÍTULO DE LA TARJETA', 'url' => '#', 'imageId' => 0, 'alt' => '', 'text' => '', 'linkText' => '', 'badge' => '' ],
						[ 'category' => 'CATEGORÍA', 'title' => 'TÍTULO DE LA TARJETA', 'url' => '#', 'imageId' => 0, 'alt' => '', 'text' => '', 'linkText' => '', 'badge' => '' ],
					],
				],
				'fields'      => array_merge(
					self::head_fields(),
					self::cols( 3, 2, 1, 4 ),
					[
						self::f( 'cardStyle', 'select', 'design', __( 'Estilo de tarjeta', 'meridian' ), [ 'options' => [ 'overlay', 'stacked', 'outline' ] ] ),
						self::f( 'ratio', 'select', 'design', __( 'Proporción de imagen', 'meridian' ), [ 'options' => [ 'portrait', 'square', 'landscape' ] ] ),
						self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'cream', 'surface', 'forest', 'light' ] ] ),
						self::f( 'items', 'repeater', 'content', __( 'Tarjetas', 'meridian' ), [ 'itemFields' => $card_item ] ),
					]
				),
			],
			[
				'slug'        => 'filter-collection',
				'name'        => __( 'Colección filtrable', 'meridian' ),
				'description' => __( 'Biblioteca con filtros por categoría, búsqueda y botón “cargar más”.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'filter',
				'defaults'    => [
					'title'       => 'ENCUENTRA LO QUE BUSCAS',
					'titleTag'    => 'h2',
					'text'        => '',
					'align'       => 'center',
					'desktop'     => 4,
					'tablet'      => 2,
					'mobile'      => 1,
					'perPage'     => 8,
					'showSearch'  => true,
					'showFilters' => true,
					'allLabel'    => 'Todo',
					'moreLabel'   => 'Cargar más',
					'emptyLabel'  => 'No hay resultados.',
					'theme'       => 'cream',
					'items'       => [
						[ 'category' => 'CATEGORÍA', 'title' => 'ELEMENTO', 'url' => '#', 'imageId' => 0, 'alt' => '', 'text' => '', 'linkText' => '', 'badge' => '' ],
					],
				],
				'fields'      => array_merge(
					[
						self::f( 'title', 'textarea', 'content', __( 'Título', 'meridian' ) ),
						self::f( 'titleTag', 'htmlTag', 'content', __( 'Etiqueta del título', 'meridian' ), [ 'options' => [ 'h1', 'h2', 'h3', 'p' ] ] ),
						self::f( 'text', 'textarea', 'content', __( 'Texto introductorio', 'meridian' ) ),
						self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
					],
					self::cols( 4, 2, 1, 5 ),
					[
						self::f( 'perPage', 'number', 'content', __( 'Elementos por tanda', 'meridian' ), [ 'min' => 2, 'max' => 48 ] ),
						self::f( 'showFilters', 'toggle', 'content', __( 'Mostrar filtros', 'meridian' ) ),
						self::f( 'showSearch', 'toggle', 'content', __( 'Mostrar buscador', 'meridian' ) ),
						self::f( 'allLabel', 'text', 'content', __( 'Etiqueta «todo»', 'meridian' ) ),
						self::f( 'moreLabel', 'text', 'content', __( 'Texto de «cargar más»', 'meridian' ) ),
						self::f( 'emptyLabel', 'text', 'content', __( 'Mensaje sin resultados', 'meridian' ) ),
						self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'cream', 'surface', 'forest', 'light' ] ] ),
						self::f( 'items', 'repeater', 'content', __( 'Elementos', 'meridian' ), [ 'itemFields' => $card_item ] ),
					]
				),
			],
			[
				'slug'        => 'review-slider',
				'name'        => __( 'Carrusel de reseñas', 'meridian' ),
				'description' => __( 'Reseñas en carrusel con autor, origen y enlace a la fuente.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'quote',
				'defaults'    => [
					'eyebrow'   => '',
					'title'     => 'RESEÑAS',
					'titleTag'  => 'h2',
					'tracking'  => 'wide',
					'align'     => 'center',
					'linkText'  => '',
					'linkUrl'   => '',
					'perView'   => 2,
					'autoplay'  => true,
					'interval'  => 6000,
					'theme'     => 'surface',
					'items'     => [
						[ 'text' => 'UNA RESEÑA BREVE Y CONTUNDENTE.', 'author' => 'NOMBRE', 'source' => 'ORIGEN', 'rating' => 5 ],
						[ 'text' => 'OTRA RESEÑA BREVE Y CONTUNDENTE.', 'author' => 'NOMBRE', 'source' => 'ORIGEN', 'rating' => 5 ],
					],
				],
				'fields'      => array_merge(
					self::head_fields(),
					[
						self::f( 'perView', 'number', 'responsive', __( 'Reseñas visibles (desktop)', 'meridian' ), [ 'min' => 1, 'max' => 3 ] ),
						self::f( 'autoplay', 'toggle', 'design', __( 'Reproducción automática', 'meridian' ) ),
						self::f( 'interval', 'number', 'design', __( 'Intervalo (ms)', 'meridian' ), [ 'min' => 2000, 'max' => 20000 ] ),
						self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'surface', 'cream', 'forest', 'light' ] ] ),
						self::f(
							'items',
							'repeater',
							'content',
							__( 'Reseñas', 'meridian' ),
							[
								'itemFields' => [
									self::f( 'text', 'textarea', 'content', __( 'Reseña', 'meridian' ) ),
									self::f( 'author', 'text', 'content', __( 'Autor', 'meridian' ) ),
									self::f( 'source', 'text', 'content', __( 'Origen', 'meridian' ) ),
									self::f( 'rating', 'number', 'content', __( 'Estrellas (0–5)', 'meridian' ), [ 'min' => 0, 'max' => 5 ] ),
								],
							]
						),
					]
				),
			],
		];
	}

	/* ------------------------------------------------------------------ */
	/* Editorial                                                           */
	/* ------------------------------------------------------------------ */

	private static function editorial(): array {
		return [
			[
				'slug'        => 'numbered-list',
				'name'        => __( 'Lista numerada', 'meridian' ),
				'description' => __( 'Bloques editoriales numerados (01, 02, 03…). Variantes: pila, acordeón y rejilla.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'list',
				'defaults'    => [
					'eyebrow'    => '',
					'title'      => '',
					'titleTag'   => 'h2',
					'tracking'   => 'wide',
					'align'      => 'left',
					'variant'    => 'stack',
					'numberStyle'=> 'pad',
					'startAt'    => 1,
					'openFirst'  => true,
					'desktop'    => 2,
					'tablet'     => 1,
					'mobile'     => 1,
					'theme'      => 'cream',
					'items'      => [
						[ 'title' => 'PRIMER PUNTO', 'text' => 'Descripción del primer punto.', 'imageId' => 0, 'alt' => '' ],
						[ 'title' => 'SEGUNDO PUNTO', 'text' => 'Descripción del segundo punto.', 'imageId' => 0, 'alt' => '' ],
					],
				],
				'fields'      => array_merge(
					[
						self::f( 'eyebrow', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
						self::f( 'title', 'textarea', 'content', __( 'Título', 'meridian' ) ),
						self::f( 'titleTag', 'htmlTag', 'content', __( 'Etiqueta del título', 'meridian' ), [ 'options' => [ 'h1', 'h2', 'h3', 'p' ] ] ),
						self::f( 'tracking', 'select', 'design', __( 'Tracking del título', 'meridian' ), [ 'options' => [ 'wide', 'normal', 'tight' ] ] ),
						self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
						self::f( 'variant', 'select', 'design', __( 'Variante', 'meridian' ), [ 'options' => [ 'stack', 'accordion', 'grid' ] ] ),
						self::f( 'numberStyle', 'select', 'design', __( 'Formato del número', 'meridian' ), [ 'options' => [ 'pad', 'plain', 'none' ] ] ),
						self::f( 'startAt', 'number', 'content', __( 'Empezar en', 'meridian' ), [ 'min' => 0, 'max' => 99 ] ),
						self::f( 'openFirst', 'toggle', 'design', __( 'Abrir el primero (acordeón)', 'meridian' ) ),
					],
					self::cols( 2, 1, 1, 3 ),
					[
						self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'cream', 'surface', 'forest', 'light' ] ] ),
						self::f(
							'items',
							'repeater',
							'content',
							__( 'Elementos', 'meridian' ),
							[
								'itemFields' => [
									self::f( 'title', 'text', 'content', __( 'Título', 'meridian' ) ),
									self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
									self::f( 'imageId', 'image', 'content', __( 'Imagen', 'meridian' ) ),
									self::f( 'alt', 'text', 'content', __( 'Texto alternativo', 'meridian' ) ),
								],
							]
						),
					]
				),
			],
			[
				'slug'        => 'statement-list',
				'name'        => __( 'Lista de hitos', 'meridian' ),
				'description' => __( 'Filas con antetítulo pequeño y afirmación grande, separadas por línea.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'statement',
				'defaults'    => [
					'eyebrow'  => '',
					'title'    => '',
					'titleTag' => 'h2',
					'tracking' => 'normal',
					'align'    => 'left',
					'theme'    => 'cream',
					'items'    => [
						[ 'label' => 'ANTETÍTULO', 'title' => 'AFIRMACIÓN DESTACADA', 'url' => '' ],
						[ 'label' => 'ANTETÍTULO', 'title' => 'OTRA AFIRMACIÓN DESTACADA', 'url' => '' ],
					],
				],
				'fields'      => [
					self::f( 'eyebrow', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
					self::f( 'title', 'textarea', 'content', __( 'Título', 'meridian' ) ),
					self::f( 'titleTag', 'htmlTag', 'content', __( 'Etiqueta del título', 'meridian' ), [ 'options' => [ 'h1', 'h2', 'h3', 'p' ] ] ),
					self::f( 'tracking', 'select', 'design', __( 'Tracking', 'meridian' ), [ 'options' => [ 'wide', 'normal', 'tight' ] ] ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
					self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'cream', 'surface', 'forest', 'light' ] ] ),
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Hitos', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'label', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
								self::f( 'title', 'textarea', 'content', __( 'Afirmación', 'meridian' ) ),
								self::f( 'url', 'url', 'content', __( 'Enlace (opcional)', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'        => 'scroll-text',
				'name'        => __( 'Texto revelado', 'meridian' ),
				'description' => __( 'Párrafo grande que se revela palabra a palabra con el scroll.', 'meridian' ),
				'category'    => 'text',
				'icon'        => 'reveal',
				'defaults'    => [
					'text'     => 'Un texto que se revela palabra a palabra mientras el visitante hace scroll.',
					'size'     => 'lg',
					'align'    => 'center',
					'maxWidth' => 900,
					'theme'    => 'cream',
				],
				'fields'      => [
					self::f( 'text', 'textarea', 'content', __( 'Texto', 'meridian' ) ),
					self::f( 'size', 'select', 'design', __( 'Tamaño', 'meridian' ), [ 'options' => [ 'md', 'lg', 'xl' ] ] ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center', 'right' ] ] ),
					self::f( 'maxWidth', 'number', 'layout', __( 'Ancho máximo (px)', 'meridian' ), [ 'min' => 320, 'max' => 1600 ] ),
					self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'cream', 'surface', 'forest', 'light' ] ] ),
				],
			],
		];
	}

	/* ------------------------------------------------------------------ */
	/* Módulos funcionales                                                 */
	/* ------------------------------------------------------------------ */

	private static function modules(): array {
		return [
			[
				'slug'        => 'trace-module',
				'name'        => __( 'Módulo de trazabilidad', 'meridian' ),
				'description' => __( 'Herramienta de consulta por código de lote que revela las etapas del recorrido del producto.', 'meridian' ),
				'category'    => 'other',
				'icon'        => 'trace',
				'defaults'    => [
					'eyebrow'     => '',
					'title'       => 'SIGUE EL RECORRIDO',
					'titleTag'    => 'h2',
					'text'        => '',
					'placeholder' => 'Código de lote',
					'buttonText'  => 'Consultar',
					'helpText'    => 'Encontrarás el código impreso en el envase.',
					'errorText'   => 'No encontramos ese código. Revísalo e inténtalo de nuevo.',
					'demoCode'    => 'DEMO-1920',
					'imageId'     => 0,
					'theme'       => 'forest',
					'align'       => 'center',
					'steps'       => [
						[ 'title' => 'ORIGEN', 'text' => 'De dónde procede.', 'meta' => '', 'imageId' => 0, 'alt' => '' ],
						[ 'title' => 'PRODUCCIÓN', 'text' => 'Cómo se elabora.', 'meta' => '', 'imageId' => 0, 'alt' => '' ],
						[ 'title' => 'ENVASADO', 'text' => 'Dónde se envasa.', 'meta' => '', 'imageId' => 0, 'alt' => '' ],
						[ 'title' => 'TU CASA', 'text' => 'Y llega hasta ti.', 'meta' => '', 'imageId' => 0, 'alt' => '' ],
					],
				],
				'fields'      => [
					self::f( 'eyebrow', 'text', 'content', __( 'Antetítulo', 'meridian' ) ),
					self::f( 'title', 'textarea', 'content', __( 'Título', 'meridian' ) ),
					self::f( 'titleTag', 'htmlTag', 'content', __( 'Etiqueta del título', 'meridian' ), [ 'options' => [ 'h1', 'h2', 'h3', 'p' ] ] ),
					self::f( 'text', 'textarea', 'content', __( 'Texto introductorio', 'meridian' ) ),
					self::f( 'placeholder', 'text', 'content', __( 'Placeholder del campo', 'meridian' ) ),
					self::f( 'buttonText', 'text', 'content', __( 'Texto del botón', 'meridian' ) ),
					self::f( 'helpText', 'text', 'content', __( 'Texto de ayuda', 'meridian' ) ),
					self::f( 'errorText', 'text', 'content', __( 'Mensaje de error', 'meridian' ) ),
					self::f( 'demoCode', 'text', 'advanced', __( 'Código de demostración', 'meridian' ) ),
					self::f( 'imageId', 'image', 'content', __( 'Imagen de fondo', 'meridian' ) ),
					self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'forest', 'cream', 'surface', 'light' ] ] ),
					self::f( 'align', 'alignment', 'design', __( 'Alineación', 'meridian' ), [ 'options' => [ 'left', 'center' ] ] ),
					self::f(
						'steps',
						'repeater',
						'content',
						__( 'Etapas', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'title', 'text', 'content', __( 'Etapa', 'meridian' ) ),
								self::f( 'text', 'textarea', 'content', __( 'Descripción', 'meridian' ) ),
								self::f( 'meta', 'text', 'content', __( 'Dato (fecha, lugar…)', 'meridian' ) ),
								self::f( 'imageId', 'image', 'content', __( 'Imagen', 'meridian' ) ),
								self::f( 'alt', 'text', 'content', __( 'Texto alternativo', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'        => 'retail-strip',
				'name'        => __( 'Banda de distribuidores', 'meridian' ),
				'description' => __( 'Franja con titular y logotipos de los puntos de venta.', 'meridian' ),
				'category'    => 'other',
				'icon'        => 'logos',
				'defaults'    => [
					'title'   => 'DISPONIBLE EN',
					'titleTag'=> 'h2',
					'tracking'=> 'wide',
					'theme'   => 'cream',
					'grayscale' => true,
					'items'   => [
						[ 'title' => '', 'imageId' => 0, 'alt' => '', 'url' => '' ],
					],
				],
				'fields'      => [
					self::f( 'title', 'textarea', 'content', __( 'Título', 'meridian' ) ),
					self::f( 'titleTag', 'htmlTag', 'content', __( 'Etiqueta del título', 'meridian' ), [ 'options' => [ 'h2', 'h3', 'p' ] ] ),
					self::f( 'tracking', 'select', 'design', __( 'Tracking', 'meridian' ), [ 'options' => [ 'wide', 'normal' ] ] ),
					self::f( 'grayscale', 'toggle', 'design', __( 'Logos en escala de grises', 'meridian' ) ),
					self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'cream', 'surface', 'forest', 'light' ] ] ),
					self::f(
						'items',
						'repeater',
						'content',
						__( 'Distribuidores', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'title', 'text', 'content', __( 'Nombre', 'meridian' ) ),
								self::f( 'imageId', 'image', 'content', __( 'Logotipo', 'meridian' ) ),
								self::f( 'alt', 'text', 'content', __( 'Texto alternativo', 'meridian' ) ),
								self::f( 'url', 'url', 'content', __( 'URL', 'meridian' ) ),
							],
						]
					),
				],
			],
			[
				'slug'        => 'info-table',
				'name'        => __( 'Tabla de datos', 'meridian' ),
				'description' => __( 'Tabla simple de dos columnas para equivalencias, medidas o datos nutricionales.', 'meridian' ),
				'category'    => 'content',
				'icon'        => 'table',
				'defaults'    => [
					'title'   => '',
					'headA'   => 'Columna A',
					'headB'   => 'Columna B',
					'caption' => '',
					'theme'   => 'surface',
					'rows'    => [
						[ 'a' => '—', 'b' => '—' ],
					],
				],
				'fields'      => [
					self::f( 'title', 'text', 'content', __( 'Título', 'meridian' ) ),
					self::f( 'headA', 'text', 'content', __( 'Cabecera A', 'meridian' ) ),
					self::f( 'headB', 'text', 'content', __( 'Cabecera B', 'meridian' ) ),
					self::f( 'caption', 'textarea', 'content', __( 'Pie de tabla', 'meridian' ) ),
					self::f( 'theme', 'select', 'colors', __( 'Tema', 'meridian' ), [ 'options' => [ 'surface', 'cream', 'light', 'forest' ] ] ),
					self::f(
						'rows',
						'repeater',
						'content',
						__( 'Filas', 'meridian' ),
						[
							'itemFields' => [
								self::f( 'a', 'text', 'content', __( 'Valor A', 'meridian' ) ),
								self::f( 'b', 'text', 'content', __( 'Valor B', 'meridian' ) ),
							],
						]
					),
				],
			],
		];
	}
}
