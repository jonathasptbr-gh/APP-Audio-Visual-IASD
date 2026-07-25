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

// O Android recusa instalar por cima de uma versão com versionCode igual ou
// maior, então ele precisa subir sozinho a cada release. No CI usamos o
// número da execução (sempre crescente); fora dele, 1.
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
                storeFile = rootProject.file("release.jks").apply {
                    writeBytes(java.util.Base64.getDecoder().decode(keystoreB64!!.trim()))
                }
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
            signingConfig = if (hasSigningKey) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            // Sem ofuscação: o app é uma casca fina; toda a lógica é JS nos
            // assets. Minificar só criaria risco de quebrar a ponte
            // @JavascriptInterface sem ganho real de tamanho.
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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
