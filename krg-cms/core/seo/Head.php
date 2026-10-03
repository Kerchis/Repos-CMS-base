<?php
/**
 * SEO head output.
 *
 * @package Meridian
 */

namespace Meridian\Seo;

defined( 'ABSPATH' ) || exit;

class Head {

	public static function get_global(): array {
		$s = get_option( MERIDIAN_OPTION_SEO, [] );
		$s = is_array( $s ) ? $s : [];
		return array_merge(
			[
				'separator' => '|',
				'robots'    => 'index,follow',
				'twitter'   => '',
				'ogImageId' => 0,
			],
			$s
		);
	}

	public static function output(): void {
		self::icons();
		if ( \Meridian\Render\Preview::is_preview() ) {
			echo '<meta name="robots" content="noindex,nofollow">' . "\n";
			return;
		}
		$global = self::get_global();
		$seo    = self::current_seo();

		$title  = $seo['title'] ?? '';
		$desc   = $seo['description'] ?? '';
		$canon  = $seo['canonical'] ?? '';
		$robots = $seo['robots'] ?? ( $global['robots'] ?? 'index,follow' );
		$og_t   = $seo['ogTitle'] ?? $title;
		$og_d   = $seo['ogDescription'] ?? $desc;
		$og_id  = absint( $seo['ogImageId'] ?? 0 );
		if ( ! $og_id ) {
			$og_id = absint( $global['ogImageId'] ?? 0 );
		}

		if ( $desc ) {
			echo '<meta name="description" content="' . esc_attr( $desc ) . '">' . "\n";
		}
		// Si las categorias estan ocultas en la web, sus archivos no se
		// borran (los enlaces de siempre siguen funcionando) pero se
		// quedan fuera de los buscadores: ensenarlas en Google seria
		// justo lo contrario de lo que pide el interruptor.
		if ( is_category() && ! \Meridian\Content\BlogSettings::show_categories() ) {
			$robots = 'noindex,nofollow';
		}
		if ( $robots ) {
			echo '<meta name="robots" content="' . esc_attr( $robots ) . '">' . "\n";
		}
		$canonical = $canon ?: ( is_singular() ? get_permalink() : home_url( '/' ) );
		echo '<link rel="canonical" href="' . esc_url( $canonical ) . '">' . "\n";
		echo '<meta property="og:locale" content="' . esc_attr( str_replace( '-', '_', get_locale() ) ) . '">' . "\n";
		echo '<meta property="og:type" content="' . ( is_singular( 'post' ) ? 'article' : 'website' ) . '">' . "\n";
		echo '<meta property="og:title" content="' . esc_attr( $og_t ?: wp_get_document_title() ) . '">' . "\n";
		if ( $og_d ) {
			echo '<meta property="og:description" content="' . esc_attr( $og_d ) . '">' . "\n";
		}
		echo '<meta property="og:url" content="' . esc_url( $canonical ) . '">' . "\n";
		echo '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '">' . "\n";
		if ( $og_id ) {
			$url = wp_get_attachment_image_url( $og_id, 'full' );
			if ( $url ) {
				echo '<meta property="og:image" content="' . esc_url( $url ) . '">' . "\n";
			}
		}
		echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
		$tw = ltrim( (string) ( $global['twitter'] ?? '' ), '@' );
		if ( $tw ) {
			echo '<meta name="twitter:site" content="@' . esc_attr( $tw ) . '">' . "\n";
		}
		self::schema();
	}

	public static function current_seo(): array {
		$seo = [];
		if ( is_singular() ) {
			$id = get_the_ID();
			if ( is_page() ) {
				$doc = \Meridian\Render\PageRenderer::current_document();
				if ( ! $doc ) {
					$doc = \Meridian\Content\PageRepository::get( $id, 'published' );
				}
				$seo = $doc['seo'] ?? [];
			} else {
				$seo = get_post_meta( $id, '_meridian_seo', true );
				$seo = is_array( $seo ) ? $seo : [];
			}
		}
		return is_array( $seo ) ? $seo : [];
	}

	public static function icons(): void {
		$identity = \Meridian\Navigation\Menus::identity();
		$id       = (int) ( $identity['faviconId'] ?: get_option( 'site_icon' ) );
		if ( ! $id ) {
			return;
		}
		$full = wp_get_attachment_image_url( $id, 'full' );
		$png  = wp_get_attachment_image_url( $id, [ 180, 180 ] );
		if ( ! $full ) {
			return;
		}
		$type = get_post_mime_type( $id ) ?: 'image/png';
		echo '<link rel="icon" href="' . esc_url( $full ) . '" type="' . esc_attr( $type ) . '">' . "\n";
		echo '<link rel="shortcut icon" href="' . esc_url( $full ) . '">' . "\n";
		if ( $png ) {
			echo '<link rel="apple-touch-icon" href="' . esc_url( $png ) . '">' . "\n";
		}
	}

	public static function schema(): void {
		$identity = \Meridian\Navigation\Menus::identity();
		$name     = $identity['siteName'] ?: get_bloginfo( 'name' );
		$logo_id  = (int) ( $identity['logoId'] ?? 0 );
		$logo     = $logo_id ? wp_get_attachment_image_url( $logo_id, 'full' ) : '';

		$website = [
			'@context' => 'https://schema.org',
			'@type'    => 'WebSite',
			'name'     => $name,
			'url'      => home_url( '/' ),
		];
		echo '<script type="application/ld+json">' . wp_json_encode( $website ) . '</script>' . "\n";

		$org = [
			'@context' => 'https://schema.org',
			'@type'    => 'Organization',
			'name'     => $name,
			'url'      => home_url( '/' ),
		];
		if ( $logo ) {
			$org['logo'] = $logo;
		}
		echo '<script type="application/ld+json">' . wp_json_encode( $org ) . '</script>' . "\n";

		$crumbs = self::breadcrumbs();
		if ( $crumbs ) {
			echo '<script type="application/ld+json">' . wp_json_encode( $crumbs ) . '</script>' . "\n";
		}

		if ( is_singular( 'post' ) ) {
			$article = [
				'@context'      => 'https://schema.org',
				'@type'         => 'Article',
				'headline'      => get_the_title(),
				'datePublished' => get_the_date( 'c' ),
				'dateModified'  => get_the_modified_date( 'c' ),
				'author'        => [ '@type' => 'Person', 'name' => get_the_author() ],
			];
			echo '<script type="application/ld+json">' . wp_json_encode( $article ) . '</script>' . "\n";
		}
	}

	public static function breadcrumbs(): ?array {
		if ( is_front_page() ) {
			return null;
		}
		$items   = [];
		$items[] = [
			'@type'    => 'ListItem',
			'position' => 1,
			'name'     => __( 'Inicio', 'meridian' ),
			'item'     => home_url( '/' ),
		];
		$pos = 2;
		if ( is_singular() ) {
			$post = get_post();
			if ( $post && $post->post_parent ) {
				$chain = array_reverse( get_post_ancestors( $post ) );
				foreach ( $chain as $pid ) {
					$items[] = [
						'@type'    => 'ListItem',
						'position' => $pos++,
						'name'     => get_the_title( $pid ),
						'item'     => get_permalink( $pid ),
					];
				}
			}
			$items[] = [
				'@type'    => 'ListItem',
				'position' => $pos,
				'name'     => get_the_title(),
				'item'     => get_permalink(),
			];
		} elseif ( is_home() ) {
			$items[] = [
				'@type'    => 'ListItem',
				'position' => $pos,
				'name'     => get_the_title( (int) get_option( 'page_for_posts' ) ) ?: __( 'Blog', 'meridian' ),
				'item'     => get_permalink( (int) get_option( 'page_for_posts' ) ) ?: home_url( '/' ),
			];
		} else {
			return null;
		}
		return [
			'@context'        => 'https://schema.org',
			'@type'           => 'BreadcrumbList',
			'itemListElement' => $items,
		];
	}

	public static function robots_txt( $output, $public ): string {
		if ( ! $public ) {
			return $output;
		}
		$output .= "\nSitemap: " . home_url( '/sitemap.xml' ) . "\n";
		return $output;
	}

	public static function title_separator( string $sep ): string {
		$g = self::get_global();
		return $g['separator'] !== '' ? (string) $g['separator'] : $sep;
	}

	public static function save_global( array $data ): array {
		$tw  = ltrim( sanitize_text_field( $data['twitter'] ?? '' ), '@' );
		$out = [
			'separator' => sanitize_text_field( $data['separator'] ?? '|' ),
			'robots'    => sanitize_text_field( $data['robots'] ?? 'index,follow' ),
			'twitter'   => $tw,
			'ogImageId' => absint( $data['ogImageId'] ?? 0 ),
		];
		update_option( MERIDIAN_OPTION_SEO, $out, false );
		return $out;
	}
}
