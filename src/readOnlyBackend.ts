import type {
  BackendProtocolV2,
  EditResult,
  FileDownloadResponse,
  FileUploadResponse,
  GlobResult,
  GrepResult,
  LsResult,
  ReadRawResult,
  ReadResult,
  WriteResult,
} from "deepagents";

export class ReadOnlyBackend implements BackendProtocolV2 {
  constructor(
    private readonly backend: BackendProtocolV2,
    private readonly label: string,
  ) {}

  ls(path: string): Promise<LsResult> {
    return Promise.resolve(this.backend.ls(path));
  }

  read(filePath: string, offset?: number, limit?: number): Promise<ReadResult> {
    return Promise.resolve(this.backend.read(filePath, offset, limit));
  }

  readRaw(filePath: string): Promise<ReadRawResult> {
    return Promise.resolve(this.backend.readRaw(filePath));
  }

  grep(pattern: string, path?: string | null, glob?: string | null): Promise<GrepResult> {
    return Promise.resolve(this.backend.grep(pattern, path, glob));
  }

  glob(pattern: string, path?: string): Promise<GlobResult> {
    return Promise.resolve(this.backend.glob(pattern, path));
  }

  write(filePath: string, _content: string): WriteResult {
    return {
      error: `${this.label} is read-only. Write denied for ${filePath}.`,
      filesUpdate: null,
    };
  }

  edit(
    filePath: string,
    _oldString: string,
    _newString: string,
    _replaceAll?: boolean,
  ): EditResult {
    return {
      error: `${this.label} is read-only. Edit denied for ${filePath}.`,
      filesUpdate: null,
    };
  }

  uploadFiles(files: Array<[string, Uint8Array]>): FileUploadResponse[] {
    return files.map(([path]) => ({
      path,
      error: "permission_denied",
    }));
  }

  downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    if (!this.backend.downloadFiles) {
      return Promise.resolve(
        paths.map((path) => ({
          path,
          content: null,
          error: "file_not_found",
        })),
      );
    }

    return Promise.resolve(this.backend.downloadFiles(paths));
  }
}
