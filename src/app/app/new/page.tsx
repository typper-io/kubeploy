'use client'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Label } from '@/components/ui/label'
import { useEffect, useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { getRepositories } from '@/actions/get-repositories'
import { createService } from '@/actions/create-service'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  domain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}$/),
})

export default function NewService() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  })

  const history = useRouter()

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setLoading(true)

      if (loading) {
        return
      }

      const cleanedEnvironmentVariables = environmentVariables.filter(
        (variable) => variable.key && variable.value
      )

      const { id, name, description } = await createService({
        ...values,
        environmentVariables: cleanedEnvironmentVariables,
        repository,
      })

      setLoading(false)

      history.push(
        `/app/service/${id}?title=${name}&description=${description}&section=logs`
      )
    } catch {
      toast('Failed to create service')

      setLoading(false)
    }
  }

  const [environmentVariables, setEnvironmentVariables] = useState<
    Array<{ key: string; value: string }>
  >([
    {
      key: '',
      value: '',
    },
  ])
  const [repository, setRepository] = useState<string>('')
  const [repositories, setRepositories] = useState<Array<string>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchRepositories = async () => {
      const repositories = await getRepositories()

      setRepositories(repositories)
    }

    fetchRepositories()
  }, [])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Service Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Project Description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <FormControl>
                <Input placeholder="example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Github Project</FormLabel>
          <FormControl>
            <Select
              onValueChange={(value) => setRepository(value)}
              value={repository}
            >
              <SelectTrigger>
                <SelectValue placeholder="Repo" />
              </SelectTrigger>
              <SelectContent>
                {repositories.map((repository) => (
                  <SelectItem key={repository} value={repository}>
                    {repository}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem>
          <FormControl>
            <Accordion type="single" collapsible>
              <AccordionItem value="1">
                <AccordionTrigger className="hover:no-underline">
                  Environment Variables
                </AccordionTrigger>
                <AccordionContent className="p-2 w-full space-y-4">
                  {environmentVariables.map((variable, index) => (
                    <>
                      <div
                        className="flex gap-2 w-full items-end"
                        key={`variable-${index}`}
                      >
                        <div className="w-full space-y-1">
                          <Label>Key</Label>
                          <Input
                            placeholder="NODE_ENV"
                            onChange={(e) => {
                              const value = e.target.value
                              setEnvironmentVariables((prev) => {
                                const copy = [...prev]
                                copy[index].key = value
                                return copy
                              })
                            }}
                            value={variable.key}
                          />
                        </div>

                        <div className="w-full space-y-1">
                          <Label>Value</Label>
                          <Input
                            placeholder="*************"
                            onChange={(e) => {
                              const value = e.target.value
                              setEnvironmentVariables((prev) => {
                                const copy = [...prev]
                                copy[index].value = value
                                return copy
                              })
                            }}
                            value={variable.value}
                          />
                        </div>

                        {index === 0 && (
                          <Button
                            type="button"
                            disabled={
                              !environmentVariables.at(-1)?.key ||
                              !environmentVariables.at(-1)?.value
                            }
                            onClick={() =>
                              setEnvironmentVariables((prev) => [
                                { key: '', value: '' },
                                ...prev,
                              ])
                            }
                          >
                            Add
                          </Button>
                        )}
                      </div>
                      {index === 0 && environmentVariables.length > 1 && (
                        <Separator />
                      )}
                    </>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </FormControl>
        </FormItem>

        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 animate-spin" />}Create project
        </Button>
      </form>
    </Form>
  )
}
