# Memforest - Living AI Memory And Document ecosystem.

This project aims to be a memory and context management system for AI workflows.

It should be easilly pluggable into claude-code, opencode, pi-coding-agent, hermes, agent-zero, any cli agent.

Let's start with pi-coding-agent and opencode as those provide the most extensible open-source foundations for our approach.

This will be a memory system that includes our plant-idea and research pipeline, and euclid as an agent (euclid is the "gardener" or manager of the forest)

It should be built first as a CLI to interact with euclid both interactive and non-interactively, using pi-tui for the interactive mode, with
pi-coding-agent underneath. And with commands like `memforest ask "question"` and `memforest upsert <document_name> "<content>"`for non-interactive usage of the vault
(for instance,  by coding agents. Let's package it as a SKILL so we can install memforest in claude code and allow claude to ask questions to euclid)

This project is the culmination of months of research into self improving agents, agentic engineering, multi-agent orchestration and scaling complex AI workloads. Treat it with respect, and always do grounding research on our context vault before planning or implementing. We have a lot of useful context and research about many related topics.
 
