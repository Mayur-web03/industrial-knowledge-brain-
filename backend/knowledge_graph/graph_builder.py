import networkx as nx
import json
import os

class KnowledgeGraphBuilder:
    def __init__(self):
        self.graph = nx.MultiDiGraph()

    def add_document_entities(self, doc_name: str, entities: dict):
        """
        Adds a document and its extracted entities as nodes,
        and creates relationships (edges) between them.
        """
        # Add the document itself as a node
        self.graph.add_node(doc_name, type="document")

        # Add equipment nodes and link to document
        for eq in entities.get("equipment", []):
            self.graph.add_node(eq, type="equipment")
            self.graph.add_edge(doc_name, eq, relation="mentions")

        # Add personnel nodes and link to document
        for person in entities.get("personnel", []):
            self.graph.add_node(person, type="personnel")
            self.graph.add_edge(doc_name, person, relation="mentions")

        # Add procedure nodes and link to document
        for proc in entities.get("procedures", []):
            self.graph.add_node(proc, type="procedure")
            self.graph.add_edge(doc_name, proc, relation="references")

        # Link referenced documents
        for ref_doc in entities.get("documents_referenced", []):
            self.graph.add_node(ref_doc, type="document")
            self.graph.add_edge(doc_name, ref_doc, relation="references")

        # Cross-link equipment mentioned in the same document
        # (this is what enables multi-hop reasoning later)
        equipment_list = entities.get("equipment", [])
        for i in range(len(equipment_list)):
            for j in range(i + 1, len(equipment_list)):
                self.graph.add_edge(
                    equipment_list[i],
                    equipment_list[j],
                    relation="co_occurs_in_document",
                    source_doc=doc_name
                )

    def get_related_entities(self, entity_name: str, depth: int = 1) -> list:
        """
        Returns entities connected to a given entity within N hops.
        This is the 'multi-hop reasoning' capability.
        """
        if entity_name not in self.graph:
            return []

        related = set()
        current_level = {entity_name}

        for _ in range(depth):
            next_level = set()
            for node in current_level:
                neighbors = list(self.graph.successors(node)) + list(self.graph.predecessors(node))
                next_level.update(neighbors)
            related.update(next_level)
            current_level = next_level

        related.discard(entity_name)
        return list(related)

    def save_graph(self, filepath: str):
        """Saves the graph as a JSON file (node-link format)."""
        data = nx.node_link_data(self.graph)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Graph saved to {filepath}")

    def load_graph(self, filepath: str):
        """Loads a graph from a JSON file."""
        with open(filepath, "r") as f:
            data = json.load(f)
        self.graph = nx.node_link_graph(data)

    def print_summary(self):
        print(f"Total nodes: {self.graph.number_of_nodes()}")
        print(f"Total edges: {self.graph.number_of_edges()}")
        print(f"Nodes: {list(self.graph.nodes(data=True))}")


if __name__ == "__main__":
    # Test with sample entities (from our entity_extractor test)
    kg = KnowledgeGraphBuilder()

    doc1_entities = {
        "equipment": ["Pump-101", "Boiler-3"],
        "personnel": ["Rajesh Kumar"],
        "dates": ["15 Jan 2024"],
        "documents_referenced": ["INC-2023-089"],
        "procedures": ["SP-45", "OISD-105"]
    }

    kg.add_document_entities("Maintenance_Report_001.pdf", doc1_entities)

    # Simulate a second document to show cross-document connections
    doc2_entities = {
        "equipment": ["Pump-101", "Valve-22"],
        "personnel": ["Suresh Patel"],
        "dates": ["20 Feb 2024"],
        "documents_referenced": [],
        "procedures": ["SP-45"]
    }

    kg.add_document_entities("Inspection_Report_002.pdf", doc2_entities)

    kg.print_summary()

    print("\n--- Entities related to Pump-101 (1 hop) ---")
    print(kg.get_related_entities("Pump-101", depth=1))

    print("\n--- Entities related to Pump-101 (2 hops) ---")
    print(kg.get_related_entities("Pump-101", depth=2))

    kg.save_graph("../../data/processed/knowledge_graph.json")