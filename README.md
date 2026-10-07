# Hello World OpenComputer agent

This project keeps agent definitions in `opencomputer/`.

Deploy agent changes to Development (Cloud):

```bash
npm run deploy -- --watch
```

Link once with `opencomputer link --project <id|slug>` or
`opencomputer link --create-project <name>`. Later commands reuse that binding.

Declare required names in `opencomputer/.env.example` and set values with
`opencomputer secrets set <name> --value-stdin`. Allowed origins are inferred
from `defineConnection()` declarations.
