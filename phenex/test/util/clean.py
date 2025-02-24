import shutil
import os


def clean():
    try:
        base_path = os.path.dirname(__file__)
        paths = [
            "../phenotypes/artifacts",
            "../cohort/artifacts",
            "../serialization/artifacts",
        ]
        for path in paths:
            path_artifacts = os.path.join(base_path, path)
            if os.path.exists(path_artifacts):
                shutil.rmtree(path_artifacts)
                print(f"Removed {path_artifacts}")
            else:
                print(f"Path does not exist: {path_artifacts}")

    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    clean()
