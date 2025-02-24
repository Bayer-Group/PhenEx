# Serialization
Serialization of PhenEx classes allows for easy data transfer and storage. PhenEx classes can easily be serialized with the to_dict() method on the given class. However, PhenEx also duplicates the interface of the built-in python JSON library with the dump, dumps, load and loads methods found here.

::: phenex.util.serialization.json