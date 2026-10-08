# SigNoz alert enricher

An OpenComputer agent that adds context to SigNoz alerts in Google Chat.

- [setup.md](setup.md): how to set up and deploy the project.
- [summary.md](summary.md): findings, pros and cons of OpenComputer.

## Purpose

This project adds data to SigNoz alerts. The data helps engineers find the
cause of a problem more quickly.

## Components

The project has these components:

1. **SigNoz.** This tool monitors the Kubernetes cluster `office-k8s`. When a
   value is more than its limit, SigNoz sends an alert.
2. **The agent.** This is a program on the OpenComputer cloud. The agent
   receives the alert and writes a message about it.
3. **Google Chat.** The agent sends the message to the space
   `office-infra-alerts`.

## Procedure: How the agent operates

1. SigNoz finds a problem. For example, a container uses more memory than its
   limit.
2. SigNoz sends the alert data to the agent through a webhook.
3. The agent reads the alert data.
4. The agent gets the alert history from SigNoz.
5. The agent writes a message. The message has these parts:
   - The name of the alert.
   - The location of the problem (pod, container, node).
   - The history of the alert for 7 days.
   - The possible causes.
   - The steps to examine the problem.
6. The agent sends the message to Google Chat.

If the alert status is "resolved", the agent does not send a message.

## Procedure: How to ask a question

You can ask the agent a question from a terminal.

1. Type the command `opencomputer run`, then type your question.
2. The agent shows the answer in the terminal.
3. If you want the answer in Google Chat, tell the agent to send it.

You can also ask a question about one alert:

1. Find the session number with the command `opencomputer session list`.
2. Type the command `opencomputer session send`, then type the session number
   and your question.
3. If you tell the agent to send the answer, the answer goes into the thread of
   that alert.

## Safety

- The agent sends a message to Google Chat only from these two inputs:
  - An alert from SigNoz.
  - A clear instruction from an operator.
- The project keeps the passwords and keys in OpenComputer. The keys are not
  in the code.

## Test equipment

The file `k8s/oom-demo.yaml` makes a pod that uses too much memory. Kubernetes
stops this pod. Then SigNoz sends an alert. Use this file to do a test of the
system.

## Project layout

| Path | Contents |
|---|---|
| `opencomputer/agents/signoz-alert-enricher/agent.ts` | The agent: prompt and tool selection |
| `opencomputer/agents/signoz-alert-enricher/tools/` | The SigNoz history tool and the Google Chat tools |
| `k8s/oom-demo.yaml` | The test pod |
| `docs/images/` | Screenshots of the messages in Google Chat |
