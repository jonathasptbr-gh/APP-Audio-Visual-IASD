// Import explícito: dentro de um build.gradle.kts o nome `java` é a extensão
// do plugin Java, que sombreia o pacote `java.*` — `java.util.Base64` não
// resolve por caminho completo.
import java.util.Base64

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Assinatura de release: a keystore chega pelo ambiente (secrets do CI),
// nunca versionada. Quando as variáveis não existem — build local, PR de
// terceiro, clone do repositório — o release cai na assinatura de debug e
// continua compilando; só não serve para atualizar por cima.
val keystoreB64: String? = System.getenv("KEYSTORE_B64")
val keyAliasEnv: String? = System.getenv("KEY_ALIAS")
val keyPasswordEnv: String? = System.getenv("KEY_PASSWORD")
val hasSigningKey = !keystoreB64.isNullOrBlank() &&
    !keyAliasEnv.isNullOrBlank() &&
    !keyPasswordEnv.isNullOrBlank()

// Válvula da PUBLICAÇÃO: `-PrequireSigning=true` transforma a ausência dos
// secrets em falha de build, e é passada só pelo passo de Release do CI.
// O fallback para a assinatura de debug (mais abaixo) existe para o build
// local/PR continuar compilando — mas ele APAGA o sinal que o workflow usava
// para detectar a falta da chave: com um signingConfig atribuído, o AGP gera
// `app-release.apk` (e não `app-release-unsigned.apk`), então a guarda por
// existência de arquivo passava e uma Release saía assinada com a debug.keystore
// que o runner gerou NAQUELA execução — chave diferente a cada run. No aparelho
// isso é INSTALL_FAILED_UPDATE_INCOMPATIBLE, e a única saída é desinstalar, o
// que apaga IndexedDB/OPFS (Cronograma, pastas, hinos e Bíblia baixados).
// Declarar a exigência aqui é o oposto de deduzi-la: quem sabe se a chave
// existe é o Gradle, e agora ele diz. (O CI ainda confere o APK pronto com o
// apksigner — cinto e suspensório, porque esta guarda depende de o passo certo
// passar a propriedade.)
val requireSigning = (project.findProperty("requireSigning") as String?).toBoolean()
if (requireSigning && !hasSigningKey) {
    throw GradleException(
        "Release assinada exigida (-PrequireSigning=true), mas a keystore não " +
        "chegou pelo ambiente. Confira os secrets KEYSTORE_B64, KEY_ALIAS e " +
        "KEY_PASSWORD."
    )
}

// O Android recusa instalar por cima de uma versão com versionCode igual ou
// maior, então ele precisa subir sozinho a cada release. Quem calcula é o CI
// (a partir da CONTAGEM DE COMMITS, que é monotônica e não depende do nome do
// workflow — ver "Definir versão" em apk.yml); fora dele, 1.
val ciVersionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
val ciVersionName = System.getenv("VERSION_NAME") ?: "1.0"

android {
    namespace = "br.org.iasd.av"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.org.iasd.av"
        // 26 (Oreo) é o piso: WebView moderno com OPFS/IndexedDB e
        // Presentation estáveis. Abaixo disso o WebView não garante OPFS.
        minSdk = 26
        targetSdk = 35
        versionCode = ciVersionCode
        versionName = ciVersionName
    }

    signingConfigs {
        if (hasSigningKey) {
            create("release") {
                // O arquivo é materializado a partir do secret em build time
                // e fica fora do repositório (ver .gitignore).
                val ks = rootProject.file("release.jks")
                // MIME, não BASIC: o `base64` do GNU coreutils quebra a linha a
                // cada 76 caracteres por padrão, e quem for rotacionar a
                // keystore (evento previsível — perdê-la é irreversível) cola
                // exatamente essa saída no secret. O decodificador BASIC lança
                // "Illegal base64 character a" diante de qualquer `\n`, e
                // `trim()` só limpa as PONTAS. O MIME ignora quebras de linha e
                // continua aceitando o formato de uma linha só (`base64 -w0`).
                ks.writeBytes(
                    try {
                        Base64.getMimeDecoder().decode(keystoreB64!!.trim())
                    } catch (e: IllegalArgumentException) {
                        // Isto acontece na fase de CONFIGURAÇÃO do Gradle: sem
                        // a mensagem própria, o erro sai como uma stack trace
                        // de configuração do projeto, sem nenhuma pista de que
                        // o problema é a formatação do secret.
                        throw GradleException("KEYSTORE_B64 inválido (não é base64): ${e.message}")
                    }
                )
                storeFile = ks
                storePassword = keyPasswordEnv
                keyAlias = keyAliasEnv
                keyPassword = keyPasswordEnv
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            // O fallback para a assinatura de debug é o que mantém o build
            // local/PR compilando. Ele NÃO é um caminho de publicação: quem
            // publica passa `-PrequireSigning=true` (acima) e o build falha
            // antes de chegar aqui se a chave não existir.
            signingConfig = if (hasSigningKey) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            // Sem ofuscação: o app é uma casca fina; toda a lógica é JS nos
            // assets. Minificar só criaria risco de quebrar a ponte
            // @JavascriptInterface sem ganho real de tamanho.
            //
            // Sem `proguardFiles` de propósito: com `isMinifyEnabled = false` o
            // R8 não roda e os arquivos passados ali não são lidos por ninguém.
            // Declará-los sugeria que as regras de keep da ponte estavam
            // valendo (e testadas) quando nunca executaram uma vez — armadilha
            // para quem um dia ligar a minificação. Ao ligar, acrescente a
            // linha DE VOLTA e valide a ponte num release instalado: as regras
            // atuais têm `-keep` explícito só para NativeBridge (mais o keep
            // genérico dos métodos @JavascriptInterface).
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    androidResources {
        // Os assets web já são texto pequeno; comprimir .js/.css/.html no APK
        // é bom, mas fontes/imagens já vêm comprimidas.
        noCompress += listOf("woff2", "png", "jpg", "webp")
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    // Apenas AndroidX oficial — nenhuma dependência de terceiros.
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
