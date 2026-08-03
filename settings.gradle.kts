pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // JitPack, e SÓ para o NewPipeExtractor (ver o `dependencies` do app e
        // a exceção registrada no CLAUDE.md). O filtro por grupo é a diferença
        // entre "abrimos uma porta para uma biblioteca" e "abrimos o projeto
        // para qualquer coisa que alguém publique num repositório de builds
        // automáticos de GitHub".
        maven {
            url = uri("https://jitpack.io")
            content { includeGroupByRegex("com\\.github\\.TeamNewPipe.*") }
        }
    }
}

rootProject.name = "AudioVisualIASD"
include(":app")
