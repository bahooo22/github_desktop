{
  "targets": [
    {
      "target_name": "printenvz",
      "type": "executable",
      "sources": [
        "src/printenvz.c"
      ],
      "include_dirs": [],
      'cflags': [
          # Ubuntu's gcc predefines _FORTIFY_SOURCE=2 as soon as the build
          # optimizes, so our own -D_FORTIFY_SOURCE=1 collided with it and
          # -Werror turned that collision into a fatal error. The level the
          # distribution ships is kept instead.
          '-Wall',
          '-Werror',
          '-fPIC',
          '-pie',
          '-fstack-protector-strong',
          '-Werror=format-security',
        ],
      'ldflags': [
        '-z relro',
        '-z now'
      ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "OTHER_CFLAGS": [
              '-Wall',
              '-Werror',
              '-Werror=format-security',
              '-fPIC',
              '-D_FORTIFY_SOURCE=1',
              '-fstack-protector-strong'
            ],
            "MACOSX_DEPLOYMENT_TARGET": "10.7"
          }
        }]
      ]
    }
  ]
}
