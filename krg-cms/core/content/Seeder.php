<?php
/**
 * Initial content.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class Seeder {

	public static function run(): void {
		if ( get_option( 'meridian_seeded' ) ) {
			return;
		}

		$home = self::page(
			__( 'Inicio', 'meridian' ),
			'inicio',
			self::home_doc()
		);
		$serv = self::page(
			__( 'Servicios', 'meridian' ),
			'servicios',
			self::services_doc()
		);
		$blog = self::page(
			__( 'Blog', 'meridian' ),
			'blog',
			self::blog_doc()
		);
		$contact = self::page(
			__( 'Contacto', 'meridian' ),
			'contacto',
			self::contact_doc()
		);

		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $home );
		update_option( 'page_for_posts', $blog );

		self::sample_posts();

		update_option( 'meridian_seeded', 1 );
		delete_option( MERIDIAN_OPTION_MENUS );
		\Meridian\Navigation\Menus::all();
	}

	private static function page( string $title, string $slug, array $sections ): int {
		$existing = get_page_by_path( $slug );
		if ( $existing ) {
			$id = $existing->ID;
		} else {
			$id = wp_insert_post(
				[
					'post_type'   => 'page',
					'post_status' => 'publish',
					'post_title'  => $title,
					'post_name'   => $slug,
				]
			);
		}
		$doc            = Document::empty( (int) $id, $title, $slug );
		$doc['status']  = 'publish';
		$doc['sections']= $sections;
		$doc            = \Meridian\Security\Sanitizer::document( $doc );
		PageRepository::write_meta( (int) $id, MERIDIAN_META_DRAFT, $doc );
		PageRepository::write_meta( (int) $id, MERIDIAN_META_PUBLISHED, $doc );
		update_post_meta( $id, MERIDIAN_META_ENABLED, '1' );
		$html = \Meridian\Render\PageRenderer::html_from_document( $doc, false, (int) $id );
		wp_update_post( [ 'ID' => $id, 'post_status' => 'publish', 'post_content' => $html ] );
		return (int) $id;
	}

	private static function nid( string $p = 'n' ): string {
		return $p . '_' . wp_generate_uuid4();
	}

	private static function node( string $type, array $props = [], array $children = [], array $extra = [] ): array {
		return array_merge(
			[
				'id'       => self::nid( $type === 'section' ? 'sec' : 'cmp' ),
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

	private static function section( string $name, array $children, array $props = [] ): array {
		return self::node( 'section', array_merge( [ 'name' => $name ], $props ), $children, [ 'name' => $name ] );
	}

	private static function home_doc(): array {
		return [
			self::section(
				'Hero',
				[
					self::node(
						'hero',
						[
							'eyebrow'  => 'CMS · Constructor · Design system',
							'title'    => 'Administra todo el sitio sin tocar código',
							'subtitle' => 'Páginas, secciones, componentes, identidad visual, blog y SEO en un solo panel. Los colores y tipografías viven en tokens, no en archivos.',
							'align'    => 'left',
							'buttons'  => [
								[ 'text' => 'Ver servicios', 'url' => '/servicios/', 'variant' => 'primary' ],
								[ 'text' => 'Ir al blog', 'url' => '/blog/', 'variant' => 'secondary' ],
							],
						]
					),
				]
			),
			self::section(
				'Números',
				[
					self::node( 'eyebrow', [ 'text' => 'Plataforma' ] ),
					self::node( 'heading', [ 'text' => 'Hecho para construir de verdad', 'tag' => 'h2' ] ),
					self::node(
						'statistics',
						[
							'items' => [
								[ 'q' => '40+', 'a' => 'Componentes' ],
								[ 'q' => '3', 'a' => 'Breakpoints' ],
								[ 'q' => '100%', 'a' => 'Tokens editables' ],
							],
						]
					),
				],
				[ 'background' => [ 'mode' => 'token', 'token' => 'color.surface' ] ]
			),
			self::section(
				'Features',
				[
					self::node( 'eyebrow', [ 'text' => 'Capacidades' ] ),
					self::node( 'heading', [ 'text' => 'Un sistema, no una plantilla', 'tag' => 'h2' ] ),
					self::node(
						'feature-grid',
						[
							'desktop' => 3,
							'items'   => [
								[ 'icon' => '▣', 'title' => 'Constructor visual', 'text' => 'Secciones, componentes, inspector de propiedades y preview real.' ],
								[ 'icon' => '◐', 'title' => 'Design tokens', 'text' => 'Cambia el primario y se actualizan botones, enlaces y estados.' ],
								[ 'icon' => '✦', 'title' => 'Blog propio', 'text' => 'Editor semántico independiente del constructor de páginas.' ],
								[ 'icon' => '☰', 'title' => 'Navegación', 'text' => 'Header, footer y menús administrables.' ],
								[ 'icon' => '◎', 'title' => 'SEO', 'text' => 'Title, description, Open Graph, sitemap nativo y HTML semántico.' ],
								[ 'icon' => '⬡', 'title' => 'Extensible', 'text' => 'Registra componentes nuevos sin reescribir el core.' ],
							],
						]
					),
				]
			),
			self::section(
				'FAQ',
				[
					self::node( 'heading', [ 'text' => 'Preguntas frecuentes', 'tag' => 'h2' ] ),
					self::node(
						'faq',
						[
							'items' => [
								[ 'q' => '¿Depende de Elementor o Gutenberg?', 'a' => 'No. KRG CMS tiene su propio modelo de páginas, secciones y componentes.' ],
								[ 'q' => '¿Puedo cambiar toda la paleta?', 'a' => 'Sí. Apariencia → Colores, o activa el preset Editorial Mint y vuelve a Marca.' ],
								[ 'q' => '¿Los cambios se publican de verdad?', 'a' => 'Guardar escribe el borrador. Publicar copia al documento published y el sitio público lo renderiza.' ],
							],
						]
					),
				]
			),
			self::section(
				'CTA',
				[
					self::node(
						'cta',
						[
							'title'    => 'Empieza por una página',
							'subtitle' => 'Entra al administrador, abre Páginas y construye.',
							'text'     => 'Contactar',
							'url'      => '/contacto/',
						]
					),
				],
				[ 'background' => [ 'mode' => 'token', 'token' => 'color.secondary' ] ]
			),
		];
	}

	private static function services_doc(): array {
		return [
			self::section(
				'Hero',
				[
					self::node(
						'hero',
						[
							'eyebrow'  => 'Servicios',
							'title'    => 'Diseño, contenido y plataforma',
							'subtitle' => 'Tres líneas de trabajo. Un solo sistema de componentes.',
							'buttons'  => [
								[ 'text' => 'Hablar', 'url' => '/contacto/', 'variant' => 'primary' ],
							],
						]
					),
				]
			),
			self::section(
				'Cards',
				[
					self::node(
						'cards-grid',
						[
							'desktop' => 3,
							'items'   => [
								[ 'title' => 'Sitios corporativos', 'text' => 'Páginas, servicios, contacto y blog con identidad administrable.' ],
								[ 'title' => 'Landings', 'text' => 'Hero, features, testimonios y CTA reutilizables.' ],
								[ 'title' => 'Contenido', 'text' => 'Editorial con HTML limpio, categorías y SEO por artículo.' ],
							],
						]
					),
				]
			),
		];
	}

	private static function blog_doc(): array {
		return [
			self::section(
				'Intro',
				[
					self::node( 'eyebrow', [ 'text' => 'Bitácora' ] ),
					self::node( 'heading', [ 'text' => 'Notas y artículos', 'tag' => 'h1' ] ),
					self::node( 'paragraph', [ 'text' => 'Las entradas se editan en el módulo Blog, independiente del constructor.' ] ),
				]
			),
			self::section(
				'Grid',
				[
					self::node( 'blog-grid', [ 'count' => 6, 'desktop' => 3 ] ),
				]
			),
		];
	}

	private static function contact_doc(): array {
		return [
			self::section(
				'Contacto',
				[
					self::node( 'eyebrow', [ 'text' => 'Contacto' ] ),
					self::node( 'heading', [ 'text' => 'Escribenos', 'tag' => 'h1' ] ),
					self::node( 'paragraph', [ 'text' => 'El formulario envía un correo al administrador del sitio.' ] ),
					self::node( 'contact-form', [ 'submit' => 'Enviar mensaje', 'showPhone' => true, 'showSubject' => true ] ),
				]
			),
		];
	}

	private static function sample_posts(): void {
		if ( wp_count_posts( 'post' )->publish > 1 ) {
			return;
		}
		$cat = wp_insert_term( 'Plataforma', 'category' );
		$cid = is_wp_error( $cat ) ? 1 : $cat['term_id'];
		$posts = [
			[ 'Cómo se construye una página en KRG CMS', '<p>Abre Páginas, crea una nueva, agrega una sección Hero y publica. El permalink aparece solo.</p>' ],
			[ 'Tokens, no hexadecimales sueltos', '<p>El color primario es un token. Los componentes usan var(--color-primary). Cambiarlo actualiza el sitio entero.</p>' ],
			[ 'Blog y constructor no son el mismo motor', '<p>Las páginas son un árbol JSON. Las entradas de blog son HTML semántico. Cada uno hace mejor su trabajo.</p>' ],
		];
		foreach ( $posts as $i => $p ) {
			$id = wp_insert_post(
				[
					'post_type'    => 'post',
					'post_status'  => 'publish',
					'post_title'   => $p[0],
					'post_content' => $p[1],
					'post_excerpt' => wp_trim_words( wp_strip_all_tags( $p[1] ), 20 ),
				]
			);
			wp_set_post_categories( $id, [ $cid ] );
		}
	}

	public static function maybe_library(): void {
		if ( get_option( 'meridian_templates_seeded' ) ) {
			return;
		}
		if ( ! post_type_exists( 'meridian_template' ) ) {
			return;
		}
		$items = [
			[
				'name' => __( 'Hero corporativo', 'meridian' ),
				'node' => self::section(
					'Hero',
					[
						self::node(
							'hero',
							[
								'eyebrow'  => 'Plantilla',
								'title'    => 'Un titular que se puede reutilizar',
								'subtitle' => 'Guárdala como plantilla e insértala en cualquier página.',
								'buttons'  => [
									[ 'text' => 'Acción', 'url' => '/contacto/', 'variant' => 'primary' ],
								],
							]
						),
					]
				),
			],
			[
				'name' => __( 'CTA contacto', 'meridian' ),
				'node' => self::section(
					'CTA',
					[
						self::node(
							'cta',
							[
								'title'    => 'Hablemos',
								'subtitle' => 'Una llamada a la acción reutilizable.',
								'text'     => 'Contactar',
								'url'      => '/contacto/',
							]
						),
					],
					[ 'background' => [ 'mode' => 'token', 'token' => 'color.secondary' ] ]
				),
			],
			[
				'name' => __( 'FAQ', 'meridian' ),
				'node' => self::section(
					'FAQ',
					[
						self::node( 'heading', [ 'text' => 'Preguntas frecuentes', 'tag' => 'h2' ] ),
						self::node(
							'faq',
							[
								'items' => [
									[ 'q' => '¿Puedo insertar esta plantilla?', 'a' => 'Sí. Constructor → Biblioteca.' ],
									[ 'q' => '¿Es un mock?', 'a' => 'No. Inserta nodos reales en el JSON de la página.' ],
								],
							]
						),
					]
				),
			],
		];
		foreach ( $items as $item ) {
			GlobalsRepository::save( 'meridian_template', $item );
		}
		update_option( 'meridian_templates_seeded', 1 );
	}

	public static function maybe_users(): void {
		$users = [
			[ 'autor', 'autor123', 'autor@meridian.test', 'author' ],
			[ 'editor', 'editor123', 'editor@meridian.test', 'editor' ],
		];
		foreach ( $users as [ $login, $pass, $email, $role ] ) {
			if ( username_exists( $login ) ) {
				continue;
			}
			$id = wp_create_user( $login, $pass, $email );
			if ( is_wp_error( $id ) ) {
				continue;
			}
			$user = new \WP_User( $id );
			$user->set_role( $role );
		}
	}
}
