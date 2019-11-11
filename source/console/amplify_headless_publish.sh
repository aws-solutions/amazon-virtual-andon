#!/bin/bash
IFS='|'

CODEGEN="{\
\"generateCode\":false,\
\"codeLanguage\":\"javascript\",\
\"fileNamePattern\":\"src/graphql/**/*.js\",\
\"generatedFileName\":\"API\",\
\"generateDocs\":true\
}"

amplify publish \
--codegen $CODEGEN \
--yes