AGENT        ?= opencomputer-sample
KUBE_CONTEXT ?= infraspec
NAMESPACE    ?= opencomputer-demo
STAMP        := $(shell date +%H%M%S)
POD          ?= oom-demo-$(STAMP)
SESSION      ?= $(shell python3 scripts/oc.py latest 2>/dev/null)
STAMP_FILE   := .opencomputer/demo-started-at

SHELL   := /bin/bash
KUBECTL := kubectl --context $(KUBE_CONTEXT)
OC      := python3 scripts/oc.py

# Print a step banner: $(call step,Title)
define step
	@printf '\n\033[1;36m▶ %s\033[0m\n' "$(1)"
endef

.DEFAULT_GOAL := help
.PHONY: help install login whoami doctor deploy secret-signoz env-chat webhook \
        status oom wait-alert summary demo ask ask-chat follow-up sessions logs clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## ── Setup ────────────────────────────────────────────────

install: ## Install npm dependencies
	$(call step,Installing dependencies)
	npm install

login: ## Log in to OpenComputer
	$(call step,Logging in to OpenComputer (confirm the code in your browser))
	opencomputer login

whoami: ## Show the logged-in user and organization
	opencomputer whoami

doctor: ## Check the project before deploy
	$(call step,Checking the project with opencomputer doctor)
	opencomputer doctor

deploy: doctor ## Check and deploy the agent
	$(call step,Deploying the agent)
	opencomputer deploy

secret-signoz: ## Store the SigNoz API key (prompted, not echoed)
	$(call step,Storing SIGNOZ_API_KEY as an OpenComputer secret)
	read -s -p "SigNoz API key: " key && echo && printf %s "$$key" | opencomputer secrets set SIGNOZ_API_KEY --value-stdin

env-chat: ## Store the Google Chat webhook key+token (prompted, not echoed)
	$(call step,Storing GOOGLE_CHAT_WEBHOOK_QUERY as a runtime variable)
	@echo "  Paste the part after '?' in the space's webhook URL: key=...&token=..."
	read -s -p "Query: " q && echo && printf %s "$$q" | opencomputer env set GOOGLE_CHAT_WEBHOOK_QUERY --value-stdin

webhook: ## Create the SigNoz webhook (prints the URL once; keep it secret)
	$(call step,Creating the signoz-alerts webhook)
	opencomputer webhooks create signoz-alerts --agent $(AGENT)

## ── Demo ─────────────────────────────────────────────────

status: ## Show agent, secrets, webhooks and demo pods
	$(call step,Agent)
	opencomputer agents
	$(call step,Secrets and runtime variables (names only))
	opencomputer secrets list
	opencomputer env list
	$(call step,Webhooks)
	opencomputer webhooks list --agent $(AGENT) | sed -E 's#(agent-webhooks/)[^ ]+#\1<redacted>#'
	$(call step,Demo pods in $(NAMESPACE))
	$(KUBECTL) -n $(NAMESPACE) get pods 2>&1

oom: ## Start a pod that gets OOMKilled (fires the SigNoz alert)
	$(call step,Starting pod $(POD): 200Mi allocation against a 64Mi limit)
	@mkdir -p .opencomputer && date -u +%Y-%m-%dT%H:%M:%SZ > $(STAMP_FILE)
	sed 's/name: oom-demo$$/name: $(POD)/' k8s/oom-demo.yaml | $(KUBECTL) apply -f -
	@printf '  Waiting for Kubernetes to kill it'
	@until $(KUBECTL) -n $(NAMESPACE) get pod $(POD) -o jsonpath='{.status.containerStatuses[0].state.terminated.reason}' 2>/dev/null | grep -q .; do printf .; sleep 3; done; echo
	$(KUBECTL) -n $(NAMESPACE) get pod $(POD) -o wide

wait-alert: ## Wait until SigNoz calls the agent (~3 min)
	$(call step,Waiting for SigNoz to evaluate the rule and call the agent)
	$(OC) wait --since "$$(cat $(STAMP_FILE) 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)"

summary: ## Summarise a session (SESSION=<id>, default: newest)
	$(call step,What the agent did in session $(SESSION))
	$(OC) summary $(SESSION)

demo: oom wait-alert ## Full demo: OOMKill → alert → agent → Google Chat
	@$(MAKE) --no-print-directory summary
	$(call step,Done. Check the office-infra-alerts space in Google Chat)

ask: ## Ask a question in the terminal only (Q="...")
	$(call step,Asking the agent (answer stays in the terminal))
	@test -n "$(Q)" || (echo 'Usage: make ask Q="your question"' && exit 1)
	opencomputer run $(AGENT) "$(Q)"

ask-chat: ## Ask and post the answer to Google Chat (Q="...")
	$(call step,Asking the agent and posting the answer to Google Chat)
	@test -n "$(Q)" || (echo 'Usage: make ask-chat Q="your question"' && exit 1)
	opencomputer run $(AGENT) "$(Q) Post the answer to Chat."

follow-up: ## Ask about an alert; reply goes in its Chat thread (Q="..." [SESSION=<id>])
	$(call step,Follow-up in session $(SESSION) (reply goes under the alert thread))
	@test -n "$(Q)" || (echo 'Usage: make follow-up Q="your question" [SESSION=<id>]' && exit 1)
	opencomputer session send $(SESSION) "$(Q) Post the answer to Chat."

sessions: ## List recent sessions
	opencomputer session list --limit 10

logs: ## Follow runtime logs
	opencomputer logs --follow

clean: ## Delete the demo pods and namespace
	$(call step,Deleting namespace $(NAMESPACE))
	$(KUBECTL) delete namespace $(NAMESPACE) --ignore-not-found
