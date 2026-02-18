#let resume(
  info: (),
  body
) = {
  align(center)[
    #block(text(weight: "bold", size: 24pt)[#info.name])
    #v(-8pt)
    #text(size: 10pt)[
      #{
        let contact = ()
        if info.email != "" { contact.push(info.email) }
        if info.phone != "" { contact.push(info.phone) }
        if info.linkedin != "" { contact.push(link(info.linkedin)[LinkedIn]) }
        if info.github != "" and info.github != none { contact.push(link(info.github)[GitHub]) }
        contact.join(" | ")
      }
    ]
  ]
  body
}

#show: body => resume(
  info: (
    name: "John Doe",
    email: "john@example.com",
    phone: "",
    linkedin: "",
    github: ""
  ),
  body
)

Section Title
