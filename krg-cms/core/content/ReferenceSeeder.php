<?php
/**
 * Páginas de arranque construidas con la librería de componentes del sistema
 * visual de referencia.
 *
 * IMPORTANTE: esto es *contenido*, no diseño. Cada nodo que se crea aquí es un
 * componente registrado y 100 % editable desde el constructor: el usuario puede
 * cambiar textos, imágenes, variantes, colores, orden o eliminar secciones.
 * El archivo existe para que una instalación nueva arranque con el lenguaje
 * visual de las referencias ya montado, no para fijarlo.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class ReferenceSeeder {

	/* ------------------------------------------------------------------ */
	/* Helpers de construcción                                             */
	/* ------------------------------------------------------------------ */

	private static function nid( string $p = 'n' ): string {
		return $p . '_' . wp_generate_uuid4();
	}

	public static function node( string $type, array $props = [], array $children = [], array $extra = [] ): array {
		return array_merge(
			[
				'id'       => self::nid( 'section' === $type ? 'sec' : 'cmp' ),
				'type'     => $type,
				'visible'  => true,
				'source'   => 'local',
				'props'    => $props,
				'styles'   => [ 'desktop' => [], 'tablet' => [], 'mobile' => [] ],
				'children' => $children,
			],
			$extra
		);
	}

	/**
	 * Sección a sangre: envuelve módulos del sistema sin añadir contenedor ni
	 * padding propios (ver `.m-bleed` en assets/css/modules.css).
	 */
	public static function bleed( string $name, array $children ): array {
		return self::node(
			'section',
			[ 'name' => $name, 'fullWidth' => true ],
			$children,
			[ 'name' => $name, 'htmlClass' => 'm-bleed' ]
		);
	}

	/** Sección normal, con contenedor y ritmo vertical estándar. */
	public static function section( string $name, array $children, array $props = [] ): array {
		return self::node( 'section', array_merge( [ 'name' => $name ], $props ), $children, [ 'name' => $name ] );
	}

	private static function btn( string $text, string $url, string $variant = 'primary' ): array {
		return [ 'text' => $text, 'url' => $url, 'variant' => $variant, 'target' => '_self' ];
	}

	/** Marquesina reutilizada en varias páginas. */
	private static function strip( string $text, string $variant = 'solid', string $size = 'md' ): array {
		return self::bleed(
			'Marquesina',
			[
				self::node(
					'marquee',
					[
						'items'      => [
							[ 'text' => $text, 'url' => '' ],
							[ 'text' => $text, 'url' => '' ],
							[ 'text' => $text, 'url' => '' ],
						],
						'separator'  => 'star',
						'variant'    => $variant,
						'size'       => $size,
						'speed'      => 38,
						'direction'  => 'left',
						'pauseHover' => true,
					]
				),
			]
		);
	}

	/** Carril de productos reutilizado en Inicio, Nosotros y Cocina. */
	private static function bestsellers(): array {
		return self::bleed(
			'Más vendidos',
			[
				self::node(
					'product-rail',
					[
						'eyebrow'   => 'De nuestra familia a la tuya',
						'title'     => 'Nuestros más vendidos',
						'titleTag'  => 'h2',
						'tracking'  => 'normal',
						'align'     => 'center',
						'linkText'  => 'Ver más productos',
						'linkUrl'   => '/productos/',
						'desktop'   => 4,
						'tablet'    => 2,
						'mobile'    => 1,
						'layout'    => 'rail',
						'cardStyle' => 'soft',
						'arrows'    => true,
						'theme'     => 'cream',
						'items'     => [
							[ 'title' => 'Formato 340 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => '' ],
							[ 'title' => 'Formato 450 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => '' ],
							[ 'title' => 'Monodosis (20 ud.)', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => 'Nuevo' ],
							[ 'title' => 'Formato 680 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => '' ],
							[ 'title' => 'Crema 340 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '/productos/', 'badge' => '' ],
						],
					]
				),
			]
		);
	}

	/** Carrusel de reseñas reutilizado en Inicio y Productos. */
	private static function reviews(): array {
		return self::bleed(
			'Reseñas',
			[
				self::node(
					'review-slider',
					[
						'eyebrow'  => '',
						'title'    => 'Opiniones honestas',
						'titleTag' => 'h2',
						'tracking' => 'wide',
						'align'    => 'center',
						'linkText' => 'Ver todas las reseñas',
						'linkUrl'  => '#',
						'perView'  => 2,
						'autoplay' => true,
						'interval' => 6000,
						'theme'    => 'surface',
						'items'    => [
							[ 'text' => 'No toda la miel es igual. Esta es suave y deliciosa.', 'author' => 'MEL', 'source' => 'Cliente', 'rating' => 5 ],
							[ 'text' => 'Me encanta. Sostenible y rastreable.', 'author' => 'Monty', 'source' => 'Cliente', 'rating' => 5 ],
							[ 'text' => 'Sabrosa y trazable. El único producto que me ha hecho dejar una reseña.', 'author' => 'Sean', 'source' => 'Cliente', 'rating' => 5 ],
							[ 'text' => 'El sabor es dulce, con un aroma floral estupendo.', 'author' => 'T.', 'source' => 'Cliente', 'rating' => 5 ],
						],
					]
				),
			]
		);
	}

	/** CTA final reutilizado en varias páginas. */
	private static function store_cta(): array {
		return self::bleed(
			'CTA tienda',
			[
				self::node(
					'statement-cta',
					[
						'eyebrow'    => '',
						'title'      => 'Miel realmente trazable cerca de ti',
						'text'       => '',
						'buttonText' => 'Encontrar tienda',
						'buttonUrl'  => '/contacto/',
						'iconId'     => 0,
						'iconCount'  => 0,
						'imageId'    => 0,
						'overlay'    => 40,
						'theme'      => 'forest',
						'align'      => 'center',
					]
				),
			]
		);
	}


	/** Panel partido a pantalla completa (portada o ficha destacada). */
	private static function split_hero(): array {
		return self::bleed(
			'Panel partido',
			[
				self::node(
					'split-panel',
					[
						'eyebrow'     => '',
						'title'       => "RASTREA EL VIAJE\nDE TU MIEL",
						'titleTag'    => 'h2',
						'subtitle'    => 'De la flor a la colmena, de la cosecha a ti.',
						'text'        => '',
						'buttonText'  => 'Empezar',
						'buttonUrl'   => '#rastrea-tu-miel',
						'buttonStyle' => 'solid',
						'buttonArrow' => true,
						'badgeId'     => 0,
						'badgePos'    => 'title',
						'mediaSide'   => 'right',
						'ratio'       => 'half',
						'height'      => 'screen',
						'mediaFit'    => 'cover',
						'mediaTheme'  => 'surface',
						'theme'       => 'cream',
						'align'       => 'center',
						'tracking'    => 'normal',
						'reveal'      => 'fade',
						'arrows'      => true,
						'dots'        => true,
						'autoplay'    => false,
						'interval'    => 6000,
						'items'       => [],
					]
				),
			]
		);
	}

	/** Panel partido de producto, con carrusel de imágenes. */
	private static function product_panel(): array {
		return self::bleed(
			'Producto destacado',
			[
				self::node(
					'split-panel',
					[
						'eyebrow'     => 'Miel cruda trazable',
						'title'       => 'Formato 340 g',
						'titleTag'    => 'h2',
						'subtitle'    => '',
						'text'        => '',
						'buttonText'  => 'Comprar',
						'buttonUrl'   => '/productos/',
						'buttonStyle' => 'outline',
						'buttonArrow' => false,
						'badgeId'     => 0,
						'badgePos'    => 'top',
						'mediaSide'   => 'right',
						'ratio'       => 'half',
						'height'      => 'tall',
						'mediaFit'    => 'contain',
						'mediaTheme'  => 'surface',
						'theme'       => 'dark',
						'align'       => 'center',
						'tracking'    => 'normal',
						'reveal'      => 'fade',
						'arrows'      => true,
						'dots'        => true,
						'autoplay'    => false,
						'interval'    => 6000,
						'items'       => [],
					]
				),
			]
		);
	}

	/** Logotipo tipográfico monumental para cierre de página. */
	private static function wordmark_block(): array {
		return self::bleed(
			'Logotipo tipográfico',
			[
				self::node(
					'wordmark',
					[
						// El rótulo de la marca que haya puesto la cabecera, no el
						// título del WordPress: aquí se imprime a tamaño gigante y
						// un «mi-sitio-pruebas» de fábrica canta muchísimo.
						'text'        => \Meridian\Navigation\Menus::marca( \Meridian\Navigation\Menus::header() ),
						'tag'         => 'p',
						'url'         => '/',
						'fit'         => 'fill',
						'size'        => 'display',
						'tracking'    => 'normal',
						'align'       => 'center',
						'shadow'      => 'offset',
						'shadowColor' => [ 'mode' => 'token', 'token' => 'color.tertiary' ],
						'shadowX'     => 6,
						'shadowY'     => 6,
						'textColor'   => [ 'mode' => 'token', 'token' => 'color.text' ],
						'theme'       => 'cream',
						'reveal'      => 'fade',
					],
					[],
					[ 'animation' => 'rise', 'animDuration' => 900 ]
				),
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* Documentos de página                                                */
	/* ------------------------------------------------------------------ */

	public static function home(): array {
		return [
			self::bleed(
				'Pantalla de carga',
				[
					self::node(
						'preloader',
						[
							'label'     => 'RECOGIENDO NÉCTAR…',
							'claim'     => 'Prepárate para miel honesta.',
							'imageId'   => 0,
							'duration'  => 1600,
							'once'      => true,
							'showCount' => true,
						]
					),
				]
			),
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'       => 'center',
							'eyebrow'       => '',
							'title'         => "CONOCE\nTU MIEL",
							'subtitle'      => 'Sabor que puedes rastrear.',
							'subtitle2'     => 'Desde la casa de la miel.',
							'text'          => '',
							'buttons'       => [ self::btn( 'Rastrea tu bote', '#rastrea-tu-miel', 'primary' ) ],
							'imageId'       => 0,
							'mobileImageId' => 0,
							'overlay'       => 25,
							'height'        => 'tall',
							'theme'         => 'cream',
							'scrollHint'    => true,
						]
					),
				]
			),
			self::strip( 'Hecho aquí', 'solid', 'md' ),
			self::split_hero(),
			self::bleed(
				'Trazabilidad',
				[
					self::node(
						'trace-module',
						[
							'eyebrow'     => '',
							'title'       => 'Rastrea el viaje de tu miel',
							'titleTag'    => 'h2',
							'text'        => 'De la flor a la colmena, de la colmena a la cosecha, y de ahí hasta tu mesa.',
							'placeholder' => 'Código de lote',
							'buttonText'  => 'Empezar',
							'helpText'    => 'Encontrarás el código impreso en la etiqueta del bote.',
							'errorText'   => 'No encontramos ese código. Revísalo e inténtalo de nuevo.',
							'demoCode'    => '',
							'imageId'     => 0,
							'theme'       => 'forest',
							'align'       => 'center',
							'steps'       => [
								[ 'title' => 'Flor', 'text' => 'Las fuentes florales que visitaron las abejas.', 'meta' => 'Origen', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Colmena', 'text' => 'Dónde estaban asentadas las colmenas.', 'meta' => 'Ubicación', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Cosecha', 'text' => 'Cuándo y cómo se extrajo la miel.', 'meta' => 'Extracción', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Tu casa', 'text' => 'Dónde se envasó tu bote concreto.', 'meta' => 'Envasado', 'imageId' => 0, 'alt' => '' ],
							],
						],
						[],
						[ 'htmlId' => 'rastrea-tu-miel' ]
					),
				]
			),
			self::bestsellers(),
			self::bleed(
				'Historia',
				[
					self::node(
						'split-feature',
						[
							'eyebrow'    => 'De su colmena ocupada a tu casa ocupada',
							'title'      => 'Miel honesta del corazón del campo',
							'titleTag'   => 'h2',
							'text'       => '<p>Trabajamos con apicultores seleccionados uno a uno y con nuestros propios colmenares. Cada lote se analiza y se puede rastrear hasta su origen.</p>',
							'linkText'   => 'Conoce más',
							'linkUrl'    => '/nosotros/',
							'imageId'    => 0,
							'imageSide'  => 'left',
							'imageShape' => 'arch',
							'ratio'      => 'balanced',
							'theme'      => 'cream',
							'tracking'   => 'wide',
							'align'      => 'left',
						]
					),
				]
			),
			self::reviews(),
			self::bleed(
				'Distribución',
				[
					self::node(
						'retail-strip',
						[
							'title'     => 'Disponible en tus tiendas habituales',
							'titleTag'  => 'h2',
							'tracking'  => 'wide',
							'grayscale' => true,
							'theme'     => 'cream',
							'items'     => [
								[ 'title' => 'Distribuidor 1', 'imageId' => 0, 'alt' => '', 'url' => '' ],
								[ 'title' => 'Distribuidor 2', 'imageId' => 0, 'alt' => '', 'url' => '' ],
								[ 'title' => 'Distribuidor 3', 'imageId' => 0, 'alt' => '', 'url' => '' ],
							],
						]
					),
				]
			),
			self::store_cta(),
			self::wordmark_block(),
		];
	}

	public static function products(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => '',
							'title'      => 'Rastrea su dulce viaje hasta ti',
							'subtitle'   => 'Miel cruda, un solo ingrediente.',
							'subtitle2'  => '',
							'text'       => '',
							'buttons'    => [],
							'imageId'    => 0,
							'overlay'    => 25,
							'height'     => 'medium',
							'theme'      => 'cream',
							'scrollHint' => false,
						]
					),
				]
			),
			self::strip( 'Un solo ingrediente', 'solid', 'md' ),
			self::bleed(
				'Más vendidos',
				[
					self::node(
						'product-rail',
						[
							'eyebrow'   => 'De nuestra familia a la tuya',
							'title'     => 'Nuestros más vendidos',
							'titleTag'  => 'h2',
							'tracking'  => 'normal',
							'align'     => 'center',
							'linkText'  => '',
							'linkUrl'   => '',
							'desktop'   => 3,
							'tablet'    => 2,
							'mobile'    => 1,
							'layout'    => 'grid',
							'cardStyle' => 'soft',
							'arrows'    => false,
							'theme'     => 'cream',
							'items'     => [
								[ 'title' => 'Formato 340 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'Formato 450 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'Monodosis (20 ud.)', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'Formato 680 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'Formato 900 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'title' => 'Crema 340 g', 'category' => '', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Miel local',
				[
					self::node(
						'collection-grid',
						[
							'eyebrow'   => 'Miel local',
							'title'     => 'Hecha por abejas cerca de ti',
							'titleTag'  => 'h2',
							'tracking'  => 'normal',
							'align'     => 'center',
							'linkText'  => '',
							'linkUrl'   => '',
							'desktop'   => 4,
							'tablet'    => 2,
							'mobile'    => 1,
							'cardStyle' => 'stacked',
							'ratio'     => 'square',
							'theme'     => 'surface',
							'items'     => [
								[ 'category' => 'Norte', 'title' => 'Miel del norte', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Levante', 'title' => 'Miel de levante', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'SUR', 'title' => 'Miel del sur', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Meseta', 'title' => 'Miel de meseta', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Islas', 'title' => 'Miel de islas', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Pirineos', 'title' => 'Miel de montaña', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Atlántico', 'title' => 'Miel atlántica', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Interior', 'title' => 'Miel de interior', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver ficha', 'url' => '#', 'badge' => '' ],
							],
						]
					),
				]
			),
			self::product_panel(),
			self::reviews(),
			self::store_cta(),
			self::wordmark_block(),
		];
	}

	public static function about(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => 'Más que una empresa de miel',
							'title'      => 'Bienvenido a la casa de la miel',
							'subtitle'   => 'Una familia que quiere a las abejas.',
							'subtitle2'  => '',
							'text'       => '',
							'buttons'    => [],
							'imageId'    => 0,
							'overlay'    => 30,
							'height'     => 'tall',
							'theme'      => 'cream',
							'scrollHint' => true,
						]
					),
				]
			),
			self::bleed(
				'Origen',
				[
					self::node(
						'split-feature',
						[
							'eyebrow'    => 'Todo empezó hace un siglo',
							'title'      => 'Cien años aprendiendo de las abejas',
							'titleTag'   => 'h2',
							'text'       => '<p>Nuestras raíces apícolas vienen de muy atrás: un bisabuelo que aprendió el oficio en los colmenares y compró sus primeras treinta colmenas. Seguimos trabajando con apicultores de confianza y con nuestros propios colmenares, con estándares altos de seguridad, calidad, pureza y trazabilidad real.</p>',
							'linkText'   => '',
							'linkUrl'    => '',
							'imageId'    => 0,
							'imageSide'  => 'right',
							'imageShape' => 'rounded',
							'ratio'      => 'balanced',
							'theme'      => 'cream',
							'tracking'   => 'wide',
							'align'      => 'left',
						]
					),
				]
			),
			self::bleed(
				'Misión',
				[
					self::node(
						'display-type',
						[
							'eyebrow'   => 'Nuestra misión',
							'text'      => 'Cuidar a las abejas, por ellas y por nosotros',
							'tag'       => 'h2',
							'size'      => 'xl',
							'tracking'  => 'wide',
							'align'     => 'center',
							'reveal'    => 'letters',
							'colorMode' => 'inherit',
							'maxWidth'  => 1100,
						]
					),
				]
			),
			self::bleed(
				'Prácticas',
				[
					self::node(
						'numbered-list',
						[
							'eyebrow'     => 'Liderando el sector',
							'title'       => 'Estándares altos. Prácticas cuidadosas.',
							'titleTag'    => 'h2',
							'tracking'    => 'wide',
							'align'       => 'left',
							'variant'     => 'stack',
							'numberStyle' => 'pad',
							'startAt'     => 1,
							'openFirst'   => true,
							'desktop'     => 2,
							'tablet'      => 1,
							'mobile'      => 1,
							'theme'       => 'surface',
							'items'       => [
								[ 'title' => 'Colmenas cuidadas', 'text' => 'Las abejas a nuestro cargo se tratan con delicadeza y respeto.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Hecha de forma natural', 'text' => 'La miel la hacen las abejas con el néctar que recogen. Nada más.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Salud de la colmena', 'text' => 'Cuando hace falta tratar plagas o enfermedades, empezamos siempre por prácticas naturales y ecológicas.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Calidad transparente', 'text' => 'Cada lote pasa controles de seguridad alimentaria y de transparencia en la cadena de suministro.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Investigación', 'text' => 'Financiamos investigación y proyectos de salud de las abejas junto a universidades y centros especializados.', 'imageId' => 0, 'alt' => '' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Nuestra forma de trabajar',
				[
					self::node(
						'split-feature',
						[
							'eyebrow'    => 'Cómo trabajamos',
							'title'      => 'Nuestra forma de hacer las cosas',
							'titleTag'   => 'h2',
							'text'       => '<p>Respetamos a las abejas y las tratamos bien, reconociendo todo lo que tenemos en común. Como ellas, cuidamos de los nuestros, trabajamos duro, perseveramos y celebramos los éxitos dulces.</p>',
							'linkText'   => '',
							'linkUrl'    => '',
							'imageId'    => 0,
							'imageSide'  => 'left',
							'imageShape' => 'arch',
							'ratio'      => 'image-wide',
							'theme'      => 'cream',
							'tracking'   => 'wide',
							'align'      => 'left',
						]
					),
				]
			),
			self::bleed(
				'Hitos',
				[
					self::node(
						'statement-list',
						[
							'eyebrow'  => 'Innovamos',
							'title'    => 'Nuestros primeros pasos',
							'titleTag' => 'h2',
							'tracking' => 'normal',
							'align'    => 'left',
							'theme'    => 'cream',
							'items'    => [
								[ 'label' => 'Análisis constante', 'title' => 'Los primeros en montar un laboratorio propio para analizar cada lote', 'url' => '' ],
								[ 'label' => 'Transparencia', 'title' => 'Los primeros en ofrecer trazabilidad real: flor, colmena, cosecha y consumidor', 'url' => '' ],
								[ 'label' => 'Cadena de suministro', 'title' => 'Los primeros en certificar el origen y la cadena de suministro', 'url' => '' ],
								[ 'label' => 'Seguridad y calidad', 'title' => 'Los primeros en adoptar la certificación de seguridad alimentaria del sector', 'url' => '' ],
							],
						]
					),
				]
			),
			self::bestsellers(),
		];
	}

	public static function kitchen(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => 'En la cocina',
							'title'      => 'Recetas para inspirarte',
							'subtitle'   => '',
							'subtitle2'  => '',
							'text'       => '',
							'buttons'    => [],
							'imageId'    => 0,
							'overlay'    => 30,
							'height'     => 'medium',
							'theme'      => 'cream',
							'scrollHint' => false,
						]
					),
				]
			),
			self::bleed(
				'Destacadas',
				[
					self::node(
						'collection-grid',
						[
							'eyebrow'   => '',
							'title'     => 'Nuestras favoritas',
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
								[ 'category' => 'Postres', 'title' => 'Polos de fresa y miel', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => '', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Ensaladas', 'title' => 'Ensalada de brócoli', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => '', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'Limonada con miel', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => '', 'url' => '#', 'badge' => '' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Trucos',
				[
					self::node(
						'display-type',
						[
							'eyebrow'   => '',
							'text'      => 'Trucos de repostería',
							'tag'       => 'h2',
							'size'      => 'display',
							'tracking'  => 'wider',
							'align'     => 'center',
							'reveal'    => 'letters',
							'colorMode' => 'primary',
							'maxWidth'  => 0,
						]
					),
					self::node(
						'scroll-text',
						[
							'text'     => '¿Sabías que la miel puede endulzar dos o tres veces más que el azúcar? Aquí van unos trucos para que te salga bien a la primera.',
							'size'     => 'lg',
							'align'    => 'center',
							'maxWidth' => 900,
							'theme'    => 'cream',
						]
					),
				]
			),
			self::bleed(
				'Guía',
				[
					self::node(
						'numbered-list',
						[
							'eyebrow'     => '',
							'title'       => '',
							'titleTag'    => 'h2',
							'tracking'    => 'wide',
							'align'       => 'left',
							'variant'     => 'stack',
							'numberStyle' => 'pad',
							'startAt'     => 1,
							'openFirst'   => false,
							'desktop'     => 2,
							'tablet'      => 1,
							'mobile'      => 1,
							'theme'       => 'surface',
							'items'       => [
								[ 'title' => 'Cómo medirla', 'text' => 'Engrasa ligeramente el vaso medidor o caliéntalo con agua: la miel se despega sola y la medida es exacta. La miel se vende por peso, no por volumen.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Equivalencias', 'text' => 'Como se vende por peso y las recetas suelen pedir volumen, siempre necesitas un poco más de lo que crees.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Al hornear', 'text' => 'Hasta una taza puedes sustituir azúcar por miel a partes iguales. Por encima, usa entre 2/3 y 3/4 de taza de miel por cada taza de azúcar, baja el horno unos grados y reduce el resto de líquidos.', 'imageId' => 0, 'alt' => '' ],
							],
						]
					),
				]
			),
			self::section(
				'Tabla de equivalencias',
				[
					self::node(
						'info-table',
						[
							'title'   => 'Equivalencias de peso a volumen',
							'headA'   => 'Peso',
							'headB'   => 'Volumen aproximado',
							'caption' => 'Tabla orientativa para recetas de repostería.',
							'theme'   => 'surface',
							'rows'    => [
								[ 'a' => '225 g', 'b' => '2/3 de taza' ],
								[ 'a' => '340 g', 'b' => '1 taza' ],
								[ 'a' => '450 g', 'b' => '1 taza y 1/3' ],
								[ 'a' => '680 g', 'b' => '2 tazas' ],
								[ 'a' => '900 g', 'b' => '2 tazas y 2/3' ],
								[ 'a' => '1,4 kg', 'b' => '4 tazas' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Recetario',
				[
					self::node(
						'filter-collection',
						[
							'title'       => 'Encuentra la receta perfecta',
							'titleTag'    => 'h2',
							'text'        => 'Explora el recetario y encuentra un plato o una bebida que convenza hasta al paladar más exigente.',
							'align'       => 'center',
							'desktop'     => 4,
							'tablet'      => 2,
							'mobile'      => 1,
							'perPage'     => 8,
							'showSearch'  => true,
							'showFilters' => true,
							'allLabel'    => 'Todo',
							'moreLabel'   => 'Cargar más',
							'emptyLabel'  => 'No hay recetas que coincidan con ese filtro.',
							'theme'       => 'cream',
							'items'       => [
								[ 'category' => 'Carnes', 'title' => 'Lomo glaseado con miel y cebolla', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'Lassi de mango y jengibre', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Entrantes', 'title' => 'Brie al horno con miel', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Postres', 'title' => 'Tarta de calabaza', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Sopas', 'title' => 'Crema de tomate', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'Ponche de sidra', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Sopas', 'title' => 'Crema de calabaza', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'Limonada con miel', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Postres', 'title' => 'Buñuelos de miel', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Bebidas', 'title' => 'Ponche de verano', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Ensaladas', 'title' => 'Ensalada de brócoli', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
								[ 'category' => 'Postres', 'title' => 'Polos de fresa y miel', 'text' => '', 'imageId' => 0, 'alt' => '', 'linkText' => 'Ver receta', 'url' => '#', 'badge' => '' ],
							],
						]
					),
				]
			),
			self::bleed(
				'Maridajes',
				[
					self::node(
						'numbered-list',
						[
							'eyebrow'     => '',
							'title'       => 'Maridajes con miel',
							'titleTag'    => 'h2',
							'tracking'    => 'wide',
							'align'       => 'center',
							'variant'     => 'grid',
							'numberStyle' => 'pad',
							'startAt'     => 1,
							'openFirst'   => false,
							'desktop'     => 3,
							'tablet'      => 2,
							'mobile'      => 1,
							'theme'       => 'cream',
							'items'       => [
								[ 'title' => 'Hierbas y especias', 'text' => 'Infusiona la miel con hierbas y especias. Va bien en salsas, guisos, marinadas, glaseados, aliños y masa de pizza.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Fruta y frutos secos', 'text' => 'Perfecta en parfaits, sobre tortitas y ensaladas, en batidos, pincelada sobre fruta antes de asarla o glaseando frutos secos.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Lácteos', 'text' => 'Endulza leche y bebidas vegetales, helados, cereales, cafés e infusiones. Y acompaña de maravilla a los quesos.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Aves', 'text' => 'Da un punto dulce y fresco a salsas barbacoa, marinadas y glaseados. Pincela pollo, pato o pavo para una piel crujiente.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Carnes', 'text' => 'Añádela a marinadas, salsas, guisos y glaseados. Pincela costillas o asados al final de la cocción.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => 'Bebidas', 'text' => 'Aporta dulzor natural a tés fríos, cafés, zumos y batidos. Deliciosa en infusiones y en chocolate caliente.', 'imageId' => 0, 'alt' => '' ],
							],
						]
					),
				]
			),
			self::bestsellers(),
		];
	}

	public static function faq(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => 'Resuelve tus dudas',
							'title'      => 'Preguntas frecuentes',
							'subtitle'   => '',
							'subtitle2'  => '',
							'text'       => '',
							'buttons'    => [],
							'imageId'    => 0,
							'overlay'    => 25,
							'height'     => 'short',
							'theme'      => 'cream',
							'scrollHint' => false,
						]
					),
				]
			),
			self::bleed(
				'Preguntas',
				[
					self::node(
						'numbered-list',
						[
							'eyebrow'     => '',
							'title'       => '',
							'titleTag'    => 'h2',
							'tracking'    => 'wide',
							'align'       => 'left',
							'variant'     => 'accordion',
							'numberStyle' => 'pad',
							'startAt'     => 1,
							'openFirst'   => true,
							'desktop'     => 1,
							'tablet'      => 1,
							'mobile'      => 1,
							'theme'       => 'cream',
							'items'       => [
								[ 'title' => '¿qué es la miel?', 'text' => 'Es una sustancia dulce y espesa que producen las abejas a partir del néctar de las flores. Añaden enzimas y eliminan agua hasta convertirlo en miel: azúcares naturales, agua, minerales, vitaminas y enzimas.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿qué es la miel cruda?', 'text' => 'Es la miel tal y como está en la colmena o con un procesado mínimo: se atempera suavemente y se cuela, no se filtra, para conservar polen, enzimas y nutrientes.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿qué lleva dentro?', 'text' => 'Miel cruda, y nada más. Sin añadidos y sin quitar nada. Cada lote se analiza en seguridad, calidad y pureza.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿dónde estáis?', 'text' => 'Tenemos sede y centros repartidos para acortar los kilómetros entre donde se hace la miel, se cosecha y se envasa.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿cómo la conseguís?', 'text' => 'Trabajamos con apicultores de confianza, seleccionados uno a uno, y también con nuestros propios colmenares.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿qué significa trazable?', 'text' => 'Que puedes seguir el recorrido de tu bote desde la flor hasta el envase: dónde estaban las colmenas, qué flores visitaron las abejas y dónde se extrajo y envasó.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿está mezclada?', 'text' => 'No se mezcla nunca con miel de otros orígenes. Un solo ingrediente: miel cruda.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿cómo sabéis qué flores visitaron?', 'text' => 'Mediante análisis de laboratorio independiente de los pólenes presentes en la miel.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿cómo la guardo? ¿caduca?', 'text' => 'A temperatura ambiente y sin luz directa. No necesita nevera. Bien cerrada, la miel cruda no caduca.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿por qué ha cambiado de textura?', 'text' => 'Es natural: la miel cruda cristaliza con el tiempo y sigue siendo segura. Si la prefieres líquida, pon el bote en agua templada hasta que se deshagan los cristales.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿pueden tomarla bebés o personas alérgicas?', 'text' => 'Nunca debe darse miel a menores de un año. Para el resto es segura salvo alergia conocida a la miel o a productos de la abeja.', 'imageId' => 0, 'alt' => '' ],
								[ 'title' => '¿cuál es su información nutricional?', 'text' => 'Por ración de una cucharada (21 g): 60 kcal, 0 g de grasa, 0 mg de sodio, 17 g de hidratos, 17 g de azúcares y 0 g de proteína.', 'imageId' => 0, 'alt' => '' ],
							],
						]
					),
				]
			),
			self::store_cta(),
		];
	}

	public static function contact(): array {
		return [
			self::bleed(
				'Hero',
				[
					self::node(
						'brand-hero',
						[
							'variant'    => 'center',
							'eyebrow'    => 'Contacto',
							'title'      => '¿preguntas? ¿comentarios?',
							'subtitle'   => '',
							'subtitle2'  => '',
							'text'       => 'Escríbenos con el formulario y cuéntanos qué tienes en mente. Te leemos.',
							'buttons'    => [ self::btn( '¿más información?', '/faq/', 'outline' ) ],
							'imageId'    => 0,
							'overlay'    => 25,
							'height'     => 'short',
							'theme'      => 'cream',
							'scrollHint' => false,
						]
					),
				]
			),
			self::section(
				'Formulario',
				[
					self::node(
						'contact-form',
						[
							'submit'      => 'Enviar',
							'success'     => 'Mensaje enviado. Gracias.',
							'showPhone'   => false,
							'showSubject' => false,
							'showMessage' => true,
							'style'       => 'underline',
							'optIns'      => [
								[ 'label' => 'Quiero seguir el viaje de mi miel', 'required' => false ],
								[ 'label' => 'Apúntame a la newsletter', 'required' => false ],
							],
							'consent'     => 'Al enviar este formulario aceptas recibir comunicaciones por correo electrónico. Puedes darte de baja en cualquier momento desde el enlace que aparece al final de cada email.',
						]
					),
				]
			),
			self::strip( 'Te leemos', 'solid', 'md' ),
		];
	}

	/* ------------------------------------------------------------------ */
	/* Plantillas para la biblioteca del constructor                       */
	/* ------------------------------------------------------------------ */

	/**
	 * Busca la primera sección de un documento que contenga un componente del
	 * tipo indicado. Evita depender de índices numéricos, que se rompen en
	 * cuanto se reordena una página.
	 *
	 * @param array  $sections Secciones del documento.
	 * @param string $type     Slug del componente buscado.
	 */
	private static function pick( array $sections, string $type ): ?array {
		foreach ( $sections as $section ) {
			foreach ( $section['children'] ?? [] as $child ) {
				if ( ( $child['type'] ?? '' ) === $type ) {
					return $section;
				}
			}
		}
		return null;
	}

	public static function library_items(): array {
		$home    = self::home();
		$about   = self::about();
		$kitchen = self::kitchen();
		$faq     = self::faq();

		$wanted = [
			[ __( 'Hero de marca', 'meridian' ), self::pick( $home, 'brand-hero' ) ],
			[ __( 'Marquesina', 'meridian' ), self::strip( 'Texto en bucle', 'solid', 'md' ) ],
			[ __( 'Panel partido a pantalla completa', 'meridian' ), self::split_hero() ],
			[ __( 'Panel de producto con carrusel', 'meridian' ), self::product_panel() ],
			[ __( 'Módulo de trazabilidad', 'meridian' ), self::pick( $home, 'trace-module' ) ],
			[ __( 'Carril de productos', 'meridian' ), self::bestsellers() ],
			[ __( 'Bloque partido', 'meridian' ), self::pick( $home, 'split-feature' ) ],
			[ __( 'Carrusel de reseñas', 'meridian' ), self::reviews() ],
			[ __( 'Banda de distribuidores', 'meridian' ), self::pick( $home, 'retail-strip' ) ],
			[ __( 'CTA display', 'meridian' ), self::store_cta() ],
			[ __( 'Lista numerada (acordeón)', 'meridian' ), self::pick( $faq, 'numbered-list' ) ],
			[ __( 'Lista de hitos', 'meridian' ), self::pick( $about, 'statement-list' ) ],
			[ __( 'Colección filtrable', 'meridian' ), self::pick( $kitchen, 'filter-collection' ) ],
			[ __( 'Tabla de datos', 'meridian' ), self::pick( $kitchen, 'info-table' ) ],
			[ __( 'Logotipo tipográfico', 'meridian' ), self::wordmark_block() ],
		];

		$out = [];
		foreach ( $wanted as [ $name, $node ] ) {
			if ( is_array( $node ) ) {
				$out[] = [ 'name' => $name, 'node' => $node ];
			}
		}
		return $out;
	}

	/* ------------------------------------------------------------------ */
	/* Header / footer alineados con el sistema visual                     */
	/* ------------------------------------------------------------------ */

	public static function apply_chrome(): void {
		$header = array_merge(
			\Meridian\Navigation\Menus::default_header(),
			[
				'sticky'         => true,
				'ctaText'        => 'Encontrar tienda',
				'ctaUrl'         => '/contacto/',
				'height'         => 84,
				'paddingY'       => 18,
				'align'          => 'left',
				'distribute'     => 'x',
				'background'     => 'var(--color-background)',
				'color'          => 'var(--color-text)',
				'navHoverFg'     => 'var(--color-primary)',
				'navModeDesktop' => 'bar',
				'navModeTablet'  => 'drawer',
				'navModeMobile'  => 'drawer',
				'transparent'    => true,
				'transOpacity'   => 0,
				'adaptive'       => 'full',
			]
		);
		\Meridian\Navigation\Menus::save_header( $header );

		$footer = array_merge(
			\Meridian\Navigation\Menus::default_footer(),
			[
				'text'           => 'Miel honesta, trazable de la flor al bote.',
				'copyright'      => '© ' . gmdate( 'Y' ) . ' ' . get_bloginfo( 'name' ),
				'copyrightAlign' => 'center',
				'reveal'         => 'curtain',
				'columns'        => 3,
				'paddingY'       => 84,
				'background'     => 'var(--color-primary)',
				'color'          => 'var(--color-on-primary, #fff)',
				'headingColor'   => 'var(--color-on-primary, #fff)',
				'linkColor'      => 'var(--color-on-primary, #fff)',
				'linkHoverFg'    => 'var(--color-background)',
				'showSearch'     => false,
				'extraTitle'     => 'Trazabilidad',
				'extraText'      => 'Introduce el código de tu bote y sigue su recorrido completo.',
			]
		);
		\Meridian\Navigation\Menus::save_footer( $footer );
	}
}
