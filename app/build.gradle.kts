plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.org.iasd.av"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.org.iasd.av"
        // 26 (Oreo) é o piso: WebView moderno com OPFS/IndexedDB e
        // Presentation estáveis. Abaixo disso o WebView não garante OPFS.
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
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
