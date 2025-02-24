type DirectoryChangeListener = () => void;

export class DirectoryReaderWriterService {
  private static instance: DirectoryReaderWriterService;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private listeners: Set<DirectoryChangeListener> = new Set();

  private constructor() {
    this.loadStoredDirectory();
  }

  static getInstance(): DirectoryReaderWriterService {
    if (!DirectoryReaderWriterService.instance) {
      DirectoryReaderWriterService.instance = new DirectoryReaderWriterService();
    }
    return DirectoryReaderWriterService.instance;
  }

  private async loadStoredDirectory() {
    try {
      // const storedHandle = localStorage.getItem('selectedDirectory');
      // TODO get this to load the directory handle
      // this.notifyListeners();
    } catch (error) {
      console.log('No stored directory found or permission denied');
    }
  }

  private async saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
    try {
      // Request permission and store the handle
      localStorage.setItem(
        'selectedDirectory',
        JSON.stringify({
          name: handle.name,
          kind: handle.kind,
        })
      );
      this.directoryHandle = handle;
      this.notifyListeners();
    } catch (error) {
      console.error('Error saving directory handle:', error);
    }
  }

  async setSelectedDirectory(handle: FileSystemDirectoryHandle) {
    await this.saveDirectoryHandle(handle);
  }

  getSelectedDirectory(): FileSystemDirectoryHandle | null {
    return this.directoryHandle;
  }

  addChangeListener(listener: DirectoryChangeListener) {
    this.listeners.add(listener);
  }

  removeChangeListener(listener: DirectoryChangeListener) {
    this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  async getFilenamesInSelectedDirectory(): Promise<string[]> {
    if (!this.directoryHandle) {
      throw new Error('No directory selected');
    }

    const entries: string[] = [];
    // Use values() method which is the standard way to iterate over directory contents; this is the Filesystem API and apparently shows as type error but is not (type definition not updated?)
    for await (const entry of this.directoryHandle.values()) {
      entries.push(entry.name);
    }
    return entries;
  }

  async writeFile(fileName: string, content: string) {
    if (!this.directoryHandle) {
      throw new Error('No directory selected');
    }

    const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    this.notifyListeners();
  }

  async readFile(fileName: string): Promise<string> {
    if (!this.directoryHandle) {
      throw new Error('No directory selected');
    }

    const fileHandle = await this.directoryHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return await file.text();
  }
}
